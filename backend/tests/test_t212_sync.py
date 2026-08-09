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


class TestSyncEndToEnd:
    """
    Drive a full sync against an in-memory database with the network stubbed out.

    The fixture reproduces the shapes that broke earlier imports: a split whose
    close and open share a ticker, timestamp and total, dividends with no broker
    id, and a partial sell.
    """

    EXPORT = _csv(
        "Market buy,2025-02-03 10:00:00,US64110L1061,NFLX,Netflix,,EOF100,1.0000000000,100.00,EUR,1.0,,EUR,100.00,EUR,,,,,,,,",
        "Market buy,2025-02-04 10:00:00,US0378331005,AAPL,Apple,,EOF101,4.0000000000,50.00,EUR,1.0,,EUR,200.00,EUR,,,,,,,,",
        "Market sell,2025-03-01 10:00:00,US0378331005,AAPL,Apple,,EOF102,2.0000000000,60.00,EUR,1.0,,EUR,120.00,EUR,,,,,,,,",
        # Split close and open: same ticker, same timestamp, same total
        "Stock split close,2025-04-01 08:00:00,US64110L1061,NFLX,Netflix,,EOF103,1.0000000000,100.00,EUR,1.0,0.00,EUR,100.00,EUR,,,,,,,,",
        "Stock split open,2025-04-01 08:00:00,US64110L1061,NFLX,Netflix,,EOF104,10.0000000000,10.00,EUR,1.0,,EUR,100.00,EUR,,,,,,,,",
        # Dividends carry no broker id
        "Dividend (Dividend),2025-05-01 10:00:00,US0378331005,AAPL,Apple,,,2.0,0.25,EUR,1.0,,,0.50,EUR,,,,,,,,",
        "Dividend (Dividend),2025-06-01 10:00:00,US0378331005,AAPL,Apple,,,2.0,0.30,EUR,1.0,,,0.60,EUR,,,,,,,,",
        "Dividend (Dividend manufactured payment),2025-07-01 10:00:00,US64110L1061,NFLX,Netflix,,,10.0,0.05,EUR,1.0,,,0.50,EUR,,,,,,,,",
    )

    @pytest.fixture
    def session(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        from app.core.database import Base

        engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
        Base.metadata.create_all(engine)
        db = sessionmaker(bind=engine)()
        yield db
        db.close()

    @pytest.fixture
    def user(self, session):
        from app.core.security import encrypt_string
        from app.models.models import User

        user = User(
            email="sync@example.com",
            hashed_password="x",
            currency="EUR",
            trading212_api_key=encrypt_string("key"),
            trading212_api_secret=encrypt_string("secret"),
        )
        session.add(user)
        session.commit()
        return user

    def _sync(self, user, session, tmp_path, monkeypatch):
        import asyncio

        from app.routers import connectors

        export = tmp_path / "export.csv"
        export.write_text(self.EXPORT)

        async def fake_request(self, *args, **kwargs):
            return 4688535

        async def fake_download(self, report_id, save_dir):
            return str(export)

        monkeypatch.setattr(Trading212Service, "request_historical_report", fake_request)
        monkeypatch.setattr(Trading212Service, "download_report_csv", fake_download)
        return asyncio.run(connectors._perform_sync(user, session))

    def test_first_sync_imports_everything(self, user, session, tmp_path, monkeypatch):
        result = self._sync(user, session, tmp_path, monkeypatch)
        assert result["transactions_imported"] == 8
        assert result["dividends_updated"] == 3, "id-less dividends must not collapse"

    def test_split_rows_do_not_violate_uniqueness(self, user, session, tmp_path, monkeypatch):
        """Close and open share ticker/timestamp/total but have distinct ids."""
        self._sync(user, session, tmp_path, monkeypatch)

        from app.models.models import Holding, Security

        holding = (
            session.query(Holding)
            .join(Security, Holding.security_id == Security.id)
            .filter(Security.symbol == "NFLX")
            .one()
        )
        assert float(holding.quantity) == pytest.approx(10.0)
        # Basis survives the split: 100 EUR over 10 shares
        assert float(holding.avg_cost) == pytest.approx(10.0)

    def test_partial_sell_keeps_average_cost(self, user, session, tmp_path, monkeypatch):
        self._sync(user, session, tmp_path, monkeypatch)

        from app.models.models import Holding, Security

        holding = (
            session.query(Holding)
            .join(Security, Holding.security_id == Security.id)
            .filter(Security.symbol == "AAPL")
            .one()
        )
        assert float(holding.quantity) == pytest.approx(2.0)
        assert float(holding.avg_cost) == pytest.approx(50.0)

    def test_resync_is_idempotent(self, user, session, tmp_path, monkeypatch):
        self._sync(user, session, tmp_path, monkeypatch)
        second = self._sync(user, session, tmp_path, monkeypatch)

        from app.models.models import Dividend, Transaction

        assert second["transactions_imported"] == 0
        assert second["transactions_skipped"] == 8
        assert session.query(Transaction).count() == 8
        assert session.query(Dividend).count() == 3

    def test_empty_report_leaves_watermark_untouched(self, user, session, tmp_path, monkeypatch):
        import asyncio

        from app.routers import connectors

        empty = tmp_path / "empty.csv"
        empty.write_text(HEADER + "\n")

        async def fake_request(self, *args, **kwargs):
            return 1

        async def fake_download(self, report_id, save_dir):
            return str(empty)

        monkeypatch.setattr(Trading212Service, "request_historical_report", fake_request)
        monkeypatch.setattr(Trading212Service, "download_report_csv", fake_download)

        result = asyncio.run(connectors._perform_sync(user, session))
        assert result["transactions_imported"] == 0
        assert user.last_t212_sync_timestamp is None, (
            "advancing the watermark on an empty report skips that window forever"
        )
