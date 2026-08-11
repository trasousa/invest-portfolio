"""
Currency normalisation tests.

Yahoo quotes London-listed instruments in pence ("GBp"), not pounds. Uppercasing
that code turns it into "GBP" and the price is read as pounds, valuing the
holding 100x too high.
"""

from unittest.mock import patch

import pytest

from app.services import price_service
from app.services.price_service import get_exchange_rate, resolve_currency


class TestResolveCurrency:
    @pytest.mark.parametrize(
        "code,expected",
        [
            ("GBp", ("GBP", 0.01)),
            ("GBX", ("GBP", 0.01)),
            ("gbx", ("GBP", 0.01)),
            ("ILA", ("ILS", 0.01)),
            ("ZAc", ("ZAR", 0.01)),
        ],
    )
    def test_minor_units_map_to_their_major_currency(self, code, expected):
        assert resolve_currency(code) == expected

    @pytest.mark.parametrize(
        "code,expected",
        [
            ("GBP", ("GBP", 1.0)),
            ("EUR", ("EUR", 1.0)),
            ("usd", ("USD", 1.0)),
        ],
    )
    def test_major_units_are_unscaled(self, code, expected):
        assert resolve_currency(code) == expected

    @pytest.mark.parametrize("code", ["", "   ", None])
    def test_missing_code_defaults_to_usd(self, code):
        assert resolve_currency(code) == ("USD", 1.0)


class TestExchangeRate:
    @pytest.fixture(autouse=True)
    def _fixed_rate(self):
        """Pin GBP->EUR so the assertions do not depend on the live market."""
        with patch.object(price_service, "_major_unit_rate", lambda f, t: 1.15):
            yield

    def test_pence_is_a_hundredth_of_the_pound_rate(self):
        assert get_exchange_rate("GBP", "EUR") == pytest.approx(1.15)
        assert get_exchange_rate("GBp", "EUR") == pytest.approx(0.0115)

    def test_pence_to_pounds_needs_no_market_rate(self):
        assert get_exchange_rate("GBp", "GBP") == pytest.approx(0.01)

    def test_identical_currency_is_identity(self):
        assert get_exchange_rate("EUR", "EUR") == 1.0

    def test_pence_valuation_is_not_inflated(self):
        """A real holding: 32.5463 EGLN at 5691 GBp is ~EUR 2.1k, not ~EUR 185k."""
        value = 32.5463 * 5691.0 * get_exchange_rate("GBp", "EUR")
        assert value == pytest.approx(2130, rel=0.01)
