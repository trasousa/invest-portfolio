"""
Regression tests for the Trading 212 CSV import and holdings replay.

The fixtures below mirror the shapes that appear in real Trading 212 exports:
dividend rows with a blank ID column, limit orders, and stock splits that arrive
as a close/open pair sharing one timestamp.
"""

from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

import httpx
import pytest

from app.brokerage.trading212.service import Trading212Service
from app.models.models import TransactionType
from app.routers.connectors import replay_positions
from app.utils.t212_csv_parser import parse_t212_csv

HEADER = (
    "Action,Time,ISIN,Ticker,Name,Notes,ID,No. of shares,Price / share,"
    "Currency (Price / share),Exchange rate,Result,Currency (Result),Total,"
    "Currency (Total),Withholding tax,Currency (Withholding tax),"
    "Stamp duty reserve tax,Currency (Stamp duty reserve tax),"
    "Currency conversion fee,Currency (Currency conversion fee),"
    "French transaction tax,Currency (French transaction tax)"
)


def _csv(*rows: str) -> str:
    return "\n".join((HEADER, *rows)) + "\n"


def _tx(action, security_id="sec-1", shares="0", total="0"):
    return SimpleNamespace(
        security_id=security_id,
        action_type=action,
        shares=Decimal(shares),
        total_amount=Decimal(total),
    )


class TestParserActionCoverage:
    def test_limit_and_stop_orders_are_imported(self):
        rows = _csv(
            "Limit buy,2025-01-29 08:38:06,NL0010273215,ASML,ASML,,EOF1,0.2000000000,714.90,EUR,1.0,,EUR,142.98,EUR,,,,,,,,",
            "Stop sell,2025-02-10 09:00:00,NL0010273215,ASML,ASML,,EOF2,0.1000000000,720.00,EUR,1.0,,EUR,72.00,EUR,,,,,,,,",
        )
        actions = [t["action_type"] for t in parse_t212_csv(rows)]
        assert actions == ["buy", "sell"]

    def test_dividend_variants_all_map_to_dividend(self):
        rows = _csv(
            "Dividend (Dividend),2025-11-13 10:46:17,US0378331005,AAPL,Apple,,,2.5,0.221,USD,0.868,,,0.48,EUR,0.10,USD,,,,,,",
            "Dividend (Dividend manufactured payment),2025-03-17 14:07:52,US4606901001,IPG,Interpublic,,,3.0,0.2805,USD,0.915,,,0.77,EUR,0.15,USD,,,,,,",
            "Dividend (Bonus),2025-04-01 10:00:00,US0378331005,AAPL,Apple,,,1.0,0.10,USD,0.9,,,0.09,EUR,,,,,,,,",
        )
        parsed = parse_t212_csv(rows)
        assert [t["action_type"] for t in parsed] == ["dividend"] * 3

    def test_unknown_action_is_skipped(self):
        rows = _csv(
            "Teleportation,2025-01-01 00:00:00,,,,,X1,,,,,,,10.00,EUR,,,,,,,,"
        )
        assert parse_t212_csv(rows) == []


class TestExternalId:
    """Blank IDs must not collapse into a single null key."""

    DIVIDEND_ROWS = _csv(
        "Dividend (Dividend),2025-11-13 10:46:17,US0378331005,AAPL,Apple,,,2.5,0.221,USD,0.868,,,0.48,EUR,0.10,USD,,,,,,",
        "Dividend (Dividend),2025-11-14 10:46:17,US5949181045,MSFT,Microsoft,,,1.0,0.750,USD,0.868,,,0.65,EUR,0.10,USD,,,,,,",
        "Dividend (Dividend),2025-11-15 10:46:17,US1912161007,KO,Coca-Cola,,,4.0,0.485,USD,0.868,,,1.68,EUR,0.25,USD,,,,,,",
    )

    def test_blank_ids_produce_distinct_identifiers(self):
        ids = [t["external_id"] for t in parse_t212_csv(self.DIVIDEND_ROWS)]
        assert all(ids), "no transaction may carry a null external_id"
        assert len(set(ids)) == 3

    def test_identifiers_are_stable_across_reparse(self):
        first = [t["external_id"] for t in parse_t212_csv(self.DIVIDEND_ROWS)]
        second = [t["external_id"] for t in parse_t212_csv(self.DIVIDEND_ROWS)]
        assert first == second, "re-syncing a period must deduplicate, not duplicate"

    def test_broker_supplied_id_wins(self):
        rows = _csv(
            "Market buy,2025-01-29 08:38:06,NL0010273215,ASML,ASML,,EOF273091,0.2,714.90,EUR,1.0,,EUR,142.98,EUR,,,,,,,,"
        )
        assert parse_t212_csv(rows)[0]["external_id"] == "EOF273091"


class TestFeesAndTimestamps:
    def test_stamp_duty_is_included_in_fees(self):
        rows = _csv(
            "Market buy,2025-01-29 08:38:06,GB00B10RZP78,ULVR,Unilever,,EOF9,1.0,40.00,GBP,1.0,,EUR,40.00,EUR,,,0.20,GBP,0.05,EUR,,"
        )
        assert parse_t212_csv(rows)[0]["fees"] == Decimal("0.25")

    @pytest.mark.parametrize(
        "time_value,expected",
        [
            ("2025-11-10 08:00:42", datetime(2025, 11, 10, 8, 0, 42)),
            ("2025-11-10 08:00:42.123", datetime(2025, 11, 10, 8, 0, 42, 123000)),
        ],
    )
    def test_timestamp_formats(self, time_value, expected):
        rows = _csv(
            f"Deposit,{time_value},,,,,DEP1,,,,,,,300.00,EUR,,,,,,,,"
        )
        assert parse_t212_csv(rows)[0]["timestamp"] == expected


class TestReplayPositions:
    def test_partial_sell_preserves_average_cost(self):
        positions, _ = replay_positions(
            [
                _tx(TransactionType.BUY, shares="10", total="1000"),
                _tx(TransactionType.SELL, shares="4", total="500"),
            ]
        )
        position = positions["sec-1"]
        assert position["shares"] == Decimal("6")
        # 600 of the original 1000 basis remains -> avg cost is unchanged at 100
        assert position["total_cost"] == Decimal("600")

    def test_stock_split_rebases_quantity(self):
        """A 10:1 split closes 0.1356 shares and opens 1.3565 in their place."""
        positions, _ = replay_positions(
            [
                _tx(TransactionType.BUY, shares="0.1356488400", total="101.38"),
                _tx(TransactionType.STOCK_SPLIT_CLOSE, shares="0.1356488400"),
                _tx(TransactionType.STOCK_SPLIT_OPEN, shares="1.3564884000"),
            ]
        )
        position = positions["sec-1"]
        assert position["shares"] == Decimal("1.3564884000")
        # Cost basis survives the split untouched
        assert position["total_cost"] == Decimal("101.38")

    def test_stock_distribution_adds_free_shares(self):
        positions, _ = replay_positions(
            [
                _tx(TransactionType.BUY, shares="1", total="50.00"),
                _tx(TransactionType.STOCK_DISTRIBUTION, shares="1.0320000000", total="0"),
            ]
        )
        position = positions["sec-1"]
        assert position["shares"] == Decimal("2.0320000000")
        assert position["total_cost"] == Decimal("50.00")

    def test_full_sell_clears_cost_basis(self):
        positions, _ = replay_positions(
            [
                _tx(TransactionType.BUY, shares="5", total="250"),
                _tx(TransactionType.SELL, shares="5", total="300"),
            ]
        )
        assert positions["sec-1"]["shares"] == Decimal("0")
        assert positions["sec-1"]["total_cost"] == Decimal("0")

    def test_unmatched_securities_are_counted_not_dropped_silently(self):
        positions, unresolved = replay_positions(
            [
                _tx(TransactionType.BUY, security_id=None, shares="1", total="10"),
                _tx(TransactionType.BUY, shares="1", total="10"),
            ]
        )
        assert unresolved == 1
        assert list(positions) == ["sec-1"]


class TestAuthScheme:
    def test_key_and_secret_use_basic_auth(self):
        service = Trading212Service("key", "secret")
        assert service.auth == ("key", "secret")
        assert "Authorization" not in service.headers

    def test_key_only_falls_back_to_legacy_header(self):
        """Without this the request goes out unauthenticated and the API 401s."""
        service = Trading212Service("key")
        assert service.auth is None
        assert service.headers["Authorization"] == "key"


class TestReportDownload:
    """An unusable download must fail loudly rather than write a 0-byte file."""

    @staticmethod
    def _service_with_response(monkeypatch, response: httpx.Response):
        service = Trading212Service("key", "secret")

        class _Client:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc):
                return False

            async def get(self, *args, **kwargs):
                return response

        monkeypatch.setattr(
            "app.brokerage.trading212.service.httpx.AsyncClient",
            lambda *a, **kw: _Client(),
        )
        return service

    def _run(self, service):
        import asyncio

        return asyncio.run(service._download_csv_content("https://example.invalid/report"))

    def test_empty_body_is_rejected(self, monkeypatch):
        response = httpx.Response(200, content=b"", request=httpx.Request("GET", "https://x"))
        service = self._service_with_response(monkeypatch, response)
        with pytest.raises(ValueError, match="empty report"):
            self._run(service)

    def test_non_csv_body_is_rejected(self, monkeypatch):
        response = httpx.Response(
            200, content=b"<html>Access Denied</html>", request=httpx.Request("GET", "https://x")
        )
        service = self._service_with_response(monkeypatch, response)
        with pytest.raises(ValueError, match="not a Trading 212 CSV"):
            self._run(service)

    def test_valid_csv_is_returned(self, monkeypatch):
        body = HEADER.encode() + b"\nDeposit,2025-01-01 00:00:00,,,,,D1,,,,,,,10.00,EUR,,,,,,,,\n"
        response = httpx.Response(200, content=body, request=httpx.Request("GET", "https://x"))
        service = self._service_with_response(monkeypatch, response)
        assert self._run(service) == body


class TestReportStatus:
    def test_missing_report_returns_none_instead_of_raising(self, monkeypatch):
        """A queued report can lag the listing; that must not abort the sync."""
        import asyncio

        response = httpx.Response(
            200, json=[{"reportId": 999, "status": "Finished"}],
            request=httpx.Request("GET", "https://x"),
        )

        class _Client:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc):
                return False

            async def get(self, *args, **kwargs):
                return response

        monkeypatch.setattr(
            "app.brokerage.trading212.service.httpx.AsyncClient",
            lambda *a, **kw: _Client(),
        )
        service = Trading212Service("key", "secret")
        assert asyncio.run(service.get_report_status(123)) is None

    def test_report_id_matches_across_string_and_int(self, monkeypatch):
        import asyncio

        response = httpx.Response(
            200, json=[{"reportId": 4688535, "status": "Finished"}],
            request=httpx.Request("GET", "https://x"),
        )

        class _Client:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc):
                return False

            async def get(self, *args, **kwargs):
                return response

        monkeypatch.setattr(
            "app.brokerage.trading212.service.httpx.AsyncClient",
            lambda *a, **kw: _Client(),
        )
        service = Trading212Service("key", "secret")
        found = asyncio.run(service.get_report_status("4688535"))
        assert found["status"] == "Finished"

    def test_poll_interval_respects_documented_rate_limit(self):
        assert Trading212Service.REPORT_POLL_INTERVAL >= 60
