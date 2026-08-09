# pyright: reportGeneralTypeIssues=false

import asyncio
import logging
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.brokerage.trading212.service import Trading212Service
from app.core.database import SessionLocal, get_db
from app.core.security import decrypt_string, encrypt_string
from app.models.models import (
    Account,
    AccountType,
    Holding,
    Security,
    TransactionType,
    User,
)
from app.routers.auth import get_current_user

# pyright: reportGeneralTypeIssues=false

router = APIRouter()
logger = logging.getLogger(__name__)


def _sanitize_symbol(symbol: Optional[str]) -> Optional[str]:
    if not symbol:
        return None
    cleaned = symbol.strip().upper()
    return cleaned or None


def _symbol_variations(symbol: Optional[str]) -> List[str]:
    primary = _sanitize_symbol(symbol)
    if not primary:
        return []
    variations = [primary]
    # Try a single market-suffix-free variation
    if "." in primary:
        base = primary.split(".")[0]
        if base and base not in variations:
            variations.append(base)
    elif "-" in primary:
        base = primary.split("-")[0]
        if base and base not in variations:
            variations.append(base)
    else:
        stripped = primary.replace(".", "")
        if stripped and stripped != primary:
            variations.append(stripped)
    return variations[:2]


# In-flight and most recent sync per user. A sync is a long single-user job that
# only needs to survive until the client next polls, so it is kept in memory
# rather than in a table; a restart simply clears it back to "idle".
_SYNC_JOBS: Dict[int, Dict[str, Any]] = {}


POSITION_ACTIONS = [
    TransactionType.BUY,
    TransactionType.SELL,
    TransactionType.STOCK_SPLIT_OPEN,
    TransactionType.STOCK_SPLIT_CLOSE,
    TransactionType.STOCK_DISTRIBUTION,
]


def replay_positions(transactions) -> Tuple[Dict[str, Dict[str, Decimal]], int]:
    """
    Replay position-affecting transactions into share counts and cost basis.

    `transactions` must be ordered by timestamp. Returns a mapping of
    security_id -> {"shares", "total_cost"} plus the number of transactions that
    could not be attributed to a security.
    """
    positions: Dict[str, Dict[str, Decimal]] = defaultdict(
        lambda: {"shares": Decimal("0"), "total_cost": Decimal("0")}
    )
    unresolved = 0

    for tx in transactions:
        if not tx.security_id:
            unresolved += 1
            continue

        position = positions[tx.security_id]
        shares = tx.shares or Decimal("0")

        if tx.action_type == TransactionType.BUY:
            position["shares"] += shares
            position["total_cost"] += tx.total_amount or Decimal("0")
        elif tx.action_type == TransactionType.SELL:
            # Retire cost basis in proportion to the shares leaving the position,
            # otherwise avg_cost climbs with every partial sale.
            held = position["shares"]
            if held > 0:
                sold_fraction = min(shares / held, Decimal("1"))
                position["total_cost"] -= position["total_cost"] * sold_fraction
            position["shares"] -= shares
        elif tx.action_type == TransactionType.STOCK_SPLIT_CLOSE:
            # Closes the pre-split position; cost basis carries over untouched.
            position["shares"] -= shares
        elif tx.action_type == TransactionType.STOCK_SPLIT_OPEN:
            position["shares"] += shares
        elif tx.action_type == TransactionType.STOCK_DISTRIBUTION:
            # Shares received at no cost, so quantity moves but cost does not.
            position["shares"] += shares

    return positions, unresolved


class ResolveRequest(BaseModel):
    transaction_id: int
    ticker: Optional[str] = None  # If provided, map to this ticker
    delete: bool = False  # If true, delete the transaction


@router.get("/unresolved")
async def get_unresolved_transactions(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get transactions that couldn't be matched to a security."""
    from app.models.models import Transaction, TransactionType

    unresolved = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.security_id == None,
            Transaction.action_type.in_(
                [TransactionType.BUY, TransactionType.SELL, TransactionType.DIVIDEND]
            ),
        )
        .all()
    )

    return unresolved


@router.post("/resolve")
async def resolve_transaction(
    request: ResolveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually resolve or delete an unmatched transaction."""
    from app.models.models import Transaction, Security
    from app.services.price_service import get_stock_info

    tx = (
        db.query(Transaction)
        .filter(
            Transaction.id == request.transaction_id,
            Transaction.user_id == current_user.id,
        )
        .first()
    )

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if request.delete:
        db.delete(tx)
        db.commit()
        return {"status": "deleted"}

    if request.ticker:
        # Try to find or create security
        security = (
            db.query(Security).filter(Security.symbol == request.ticker.upper()).first()
        )
        if not security:
            info = get_stock_info(request.ticker)
            if info:
                security = Security(
                    symbol=info["symbol"],
                    name=info["name"],
                    current_price=info["price"],
                    type=info.get("type", "stock"),
                )
                db.add(security)
                db.flush()
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not find stock data for ticker: {request.ticker}",
                )

        tx.security_id = security.id
        tx.ticker = security.symbol
        db.commit()
        return {"status": "resolved", "security": security.symbol}

    return {"status": "no action"}


class ConnectRequest(BaseModel):
    api_key: str
    api_secret: Optional[str] = None
    is_demo: bool = False


# The profile endpoint masks stored credentials with bullets. If that mask ever
# makes it back here it means the client posted the placeholder instead of a real
# key, which would otherwise be encrypted and stored as the user's credentials.
_MASK_CHARS = "•*"


def _clean_credential(value: Optional[str], field: str) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if all(ch in _MASK_CHARS for ch in cleaned):
        raise HTTPException(
            status_code=400,
            detail=f"Please re-enter your {field}; the masked placeholder cannot be used.",
        )
    return cleaned


class SyncResponse(BaseModel):
    status: str
    message: str = ""
    positions_updated: int
    cash_updated: float
    dividends_updated: int
    transactions_imported: int = 0
    transactions_skipped: int = 0
    unresolved_transactions: int = 0


@router.post("/trading212/connect")
async def connect_trading212(
    request: ConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save Trading212 API Key and validate connection."""
    api_key = _clean_credential(request.api_key, "API key")
    api_secret = _clean_credential(request.api_secret, "API secret")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required")

    service = Trading212Service(api_key, api_secret, request.is_demo)

    try:
        if not await service.validate_connection():
            raise HTTPException(
                status_code=400, detail="Invalid API Key or connection failed"
            )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="Rate limited by Trading 212. Please wait 30 seconds and try again.",
            )
        raise HTTPException(
            status_code=e.response.status_code, detail=f"Connection failed: {str(e)}"
        )

    # Add delay to prevent rate limiting (Trading 212 has strict rate limits)
    import asyncio

    await asyncio.sleep(1)

    # Encrypt and save
    current_user.trading212_api_key = encrypt_string(api_key)
    # Clear any stale secret when connecting with a key-only credential, otherwise
    # the next sync would pair the new key with the previous account's secret.
    current_user.trading212_api_secret = (
        encrypt_string(api_secret) if api_secret else None
    )
    current_user.trading212_is_demo = request.is_demo
    db.commit()

    return {"status": "connected"}


@router.post("/trading212/validate")
async def validate_trading212(
    request: ConnectRequest, current_user: User = Depends(get_current_user)
):
    """Validate Trading212 API Key without saving."""
    api_key = _clean_credential(request.api_key, "API key")
    api_secret = _clean_credential(request.api_secret, "API secret")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required")

    service = Trading212Service(api_key, api_secret, request.is_demo)

    try:
        if not await service.validate_connection():
            raise HTTPException(
                status_code=400, detail="Invalid API Key or connection failed"
            )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="Rate limited by Trading 212. Please wait 30 seconds and try again.",
            )
        raise HTTPException(
            status_code=e.response.status_code, detail=f"Connection failed: {str(e)}"
        )

    return {"status": "valid"}


@router.post("/trading212/sync")
async def sync_trading212(current_user: User = Depends(get_current_user)):
    """
    Start a Trading 212 sync in the background.

    Trading 212 generates the historical report asynchronously and only allows the
    export listing to be polled once a minute, so a sync can legitimately run for
    several minutes - far longer than any proxy will hold a request open. The work
    therefore runs as a background task and the client polls /trading212/sync/status.
    """
    if not current_user.trading212_api_key:
        raise HTTPException(status_code=400, detail="Trading212 not connected")

    job = _SYNC_JOBS.get(current_user.id)
    if job and job.get("status") == "running":
        return {"status": "running", "message": "A sync is already in progress"}

    _SYNC_JOBS[current_user.id] = {
        "status": "running",
        "message": "Requesting historical report from Trading 212...",
        "started_at": datetime.utcnow().isoformat(),
        "result": None,
    }

    asyncio.create_task(_run_sync_job(current_user.id))

    return {"status": "started", "message": "Sync started"}


@router.get("/trading212/sync/status")
async def get_sync_status(current_user: User = Depends(get_current_user)):
    """Report the state of this user's most recent sync."""
    job = _SYNC_JOBS.get(current_user.id)
    if not job:
        return {"status": "idle", "message": "", "result": None}
    return job


async def _run_sync_job(user_id: int) -> None:
    """Run a sync against its own database session and record the outcome."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            _SYNC_JOBS[user_id] = {
                "status": "error",
                "message": "User no longer exists",
                "result": None,
            }
            return

        result = await _perform_sync(user, db)
        _SYNC_JOBS[user_id] = {
            "status": "success",
            "message": result.get("message", "Sync complete"),
            "result": result,
        }
    except HTTPException as e:
        logger.error(f"❌ Sync failed for user {user_id}: {e.detail}")
        db.rollback()
        _SYNC_JOBS[user_id] = {
            "status": "error",
            "message": str(e.detail),
            "result": None,
        }
    except Exception as e:
        logger.error(f"❌ Sync failed for user {user_id}: {e}", exc_info=True)
        db.rollback()
        _SYNC_JOBS[user_id] = {"status": "error", "message": str(e), "result": None}
    finally:
        db.close()


async def _perform_sync(current_user: User, db: Session) -> dict:
    """
    Sync portfolio from Trading212 using CSV historical reports only.

    - First sync: fetches the longest history the API will produce
    - Subsequent syncs: fetches only new data since last sync
    - Deduplicates transactions using external_id
    - Updates holdings, dividends, and security history
    """
    if not current_user.trading212_api_key:
        raise HTTPException(status_code=400, detail="Trading212 not connected")

    api_key = decrypt_string(current_user.trading212_api_key).strip()
    api_secret = (
        decrypt_string(current_user.trading212_api_secret).strip()
        if current_user.trading212_api_secret
        else None
    )
    is_demo = (
        current_user.trading212_is_demo
        if hasattr(current_user, "trading212_is_demo")
        else False
    )
    service = Trading212Service(api_key, api_secret, is_demo)

    def _progress(message: str) -> None:
        """Surface the current stage so the polling client can display it."""
        job = _SYNC_JOBS.get(current_user.id)
        if job is not None:
            job["message"] = message

    try:
        from datetime import timedelta

        from app.models.models import Dividend, Transaction
        from app.utils.isin_resolver import get_ticker_from_isin
        from app.utils.t212_csv_parser import parse_t212_csv

        logger.info("=" * 60)
        logger.info("🚀 Starting Trading 212 Sync")
        logger.info("=" * 60)

        # Step 1: Determine date range for CSV report
        logger.info("📅 Determining sync date range...")

        # Report timestamps are UTC ("Z"), so build them from UTC rather than the
        # server's local clock - otherwise timeTo lands in the future on any host
        # that is ahead of UTC and the report request is rejected.
        time_to = datetime.utcnow()

        is_first_sync = current_user.last_t212_sync_timestamp is None
        if is_first_sync:
            # Positions opened before the exported window produce impossible
            # negative share counts, so reach back as far as the API will allow.
            candidate_windows = [365 * 10, 365 * 5, 365 * 2, 365]
            logger.info("   First sync - fetching the longest available history")
        else:
            # Subsequent sync - from last sync to now, with 1 day overlap to be safe
            delta_days = max(
                (time_to - current_user.last_t212_sync_timestamp).days + 1, 1
            )
            candidate_windows = [delta_days]
            logger.info(f"   Delta sync - fetching the last {delta_days} day(s)")

        def _fmt(moment: datetime) -> str:
            return moment.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        time_to_str = _fmt(time_to)

        logger.info("📥 Requesting historical report...")
        _progress("Requesting historical report from Trading 212...")

        report_id = None
        time_from = time_to - timedelta(days=candidate_windows[0])
        for index, window_days in enumerate(candidate_windows):
            time_from = time_to - timedelta(days=window_days)
            logger.info(f"   Period: {time_from.date()} to {time_to.date()}")
            try:
                report_id = await service.request_historical_report(
                    _fmt(time_from), time_to_str
                )
                logger.info(f"   ✓ Report {report_id} requested successfully")
                break
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.error("   ❌ Rate limited - too many recent requests")
                    raise HTTPException(
                        status_code=429,
                        detail="Rate limited. Trading 212 allows 1 report request per 30-60 seconds. Please wait and try again.",
                    )
                is_last_window = index == len(candidate_windows) - 1
                if e.response.status_code == 400 and not is_last_window:
                    logger.warning(
                        f"   ⚠️ {window_days} day report rejected, trying a shorter window..."
                    )
                    continue
                raise

        # Step 3: Wait for report to generate and download
        # Trading 212 needs time to generate the report
        # The download_report_csv method already polls with timeouts
        logger.info(
            f"⏳ Waiting for report to generate (this may take 30-60 seconds)..."
        )

        try:
            csv_filepath = await service.download_report_csv(
                report_id, f"data/trading212/reports/user_{current_user.id}"
            )
            logger.info(f"   ✓ CSV downloaded: {csv_filepath}")
        except Exception as e:
            logger.error(f"   ❌ Failed to download report: {e}")
            raise

        # Step 4: Parse CSV
        logger.info("📊 Parsing CSV...")
        _progress("Parsing report...")
        with open(csv_filepath, "r") as f:
            csv_content = f.read()

        all_parsed_transactions = parse_t212_csv(csv_content)
        logger.info(f"   ✓ Parsed {len(all_parsed_transactions)} transactions")

        # Step 4: Import transactions with deduplication
        logger.info("💾 Importing transactions...")
        _progress("Importing transactions...")
        new_transactions = 0
        skipped_duplicates = 0

        for tx_data in all_parsed_transactions:
            # Check for duplicate
            existing = (
                db.query(Transaction)
                .filter(
                    Transaction.external_id == tx_data["external_id"],
                    Transaction.broker_name == "Trading212",
                    Transaction.user_id == current_user.id,
                )
                .first()
            )

            if existing:
                skipped_duplicates += 1
                continue

            # Resolve ticker from ISIN if available
            primary_symbol = _sanitize_symbol(tx_data.get("ticker"))
            if tx_data.get("isin") and not primary_symbol:
                primary_symbol = _sanitize_symbol(
                    await get_ticker_from_isin(tx_data["isin"])
                )

            symbol_candidates = _symbol_variations(primary_symbol)
            if not symbol_candidates and tx_data.get("security_name"):
                inferred = _sanitize_symbol(tx_data["security_name"].split(" ")[0])
                symbol_candidates = _symbol_variations(inferred)

            dedupe_symbol = (
                symbol_candidates[0]
                if symbol_candidates
                else _sanitize_symbol(tx_data.get("security_name"))
            )

            if dedupe_symbol:
                conflict = (
                    db.query(Transaction)
                    .filter(
                        Transaction.user_id == current_user.id,
                        Transaction.broker_name == "Trading212",
                        Transaction.action_type == tx_data["action_type"],
                        Transaction.timestamp == tx_data["timestamp"],
                        Transaction.total_amount == tx_data["total_amount"],
                        Transaction.ticker == dedupe_symbol,
                    )
                    .first()
                )
                if conflict:
                    skipped_duplicates += 1
                    continue

            # Find or create security (try primary + one variation)
            security = None
            resolved_symbol = None
            for candidate in symbol_candidates:
                security = (
                    db.query(Security).filter(Security.symbol == candidate).first()
                )
                if security:
                    resolved_symbol = candidate
                    break

            if not security and primary_symbol and tx_data.get("security_name"):
                security = Security(
                    symbol=primary_symbol,
                    name=tx_data["security_name"],
                    type="stock",
                )
                db.add(security)
                db.flush()
                resolved_symbol = primary_symbol

            stored_ticker = (
                resolved_symbol
                or dedupe_symbol
                or _sanitize_symbol(tx_data.get("isin"))
                or tx_data.get("ticker")
            )

            # Create transaction
            transaction = Transaction(
                user_id=current_user.id,
                security_id=security.id if security else None,
                external_id=tx_data["external_id"],
                broker_name=tx_data["broker_name"],
                action_type=tx_data["action_type"],
                timestamp=tx_data["timestamp"],
                isin=tx_data.get("isin"),
                ticker=stored_ticker,
                security_name=tx_data.get("security_name"),
                shares=tx_data.get("shares"),
                price_per_share=tx_data.get("price_per_share"),
                price_currency=tx_data.get("price_currency"),
                total_amount=tx_data["total_amount"],
                total_currency=tx_data["total_currency"],
                exchange_rate=tx_data.get("exchange_rate"),
                fees=tx_data.get("fees", 0),
                currency_conversion_fee=tx_data.get("currency_conversion_fee", 0),
                withholding_tax=tx_data.get("withholding_tax", 0),
                withholding_tax_currency=tx_data.get("withholding_tax_currency"),
                french_transaction_tax=tx_data.get("french_transaction_tax", 0),
                result_amount=tx_data.get("result_amount"),
                result_currency=tx_data.get("result_currency"),
                notes=tx_data.get("notes"),
                raw_data=tx_data.get("raw_data"),
            )
            db.add(transaction)
            new_transactions += 1

        db.commit()
        logger.info(
            f"✓ Imported {new_transactions} new transactions ({skipped_duplicates} duplicates skipped)"
        )

        # Step 5: Update holdings from transactions
        logger.info("📈 Recalculating holdings from transactions...")
        _progress("Recalculating holdings...")

        # Get or create Trading212 account
        account = (
            db.query(Account)
            .filter(Account.owner_id == current_user.id, Account.name == "Trading212")
            .first()
        )

        if not account:
            account = Account(
                name="Trading212",
                type="investment",
                currency=current_user.currency,
                owner_id=current_user.id,
                balance=0.0,
            )
            db.add(account)
            db.flush()

        # Every action that moves a share count has to be replayed here. Splits in
        # particular arrive as a close (old share count) plus an open (new share
        # count) at the same timestamp; ignoring them leaves the position stuck at
        # the pre-split quantity.
        position_transactions = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.broker_name == "Trading212",
                Transaction.action_type.in_(POSITION_ACTIONS),
            )
            .order_by(Transaction.timestamp)
            .all()
        )

        holdings_data, unresolved_positions = replay_positions(position_transactions)

        if unresolved_positions:
            logger.warning(
                f"   ⚠️ {unresolved_positions} position transactions have no matched "
                "security and are excluded from holdings"
            )

        # Drop holdings whose transactions no longer add up to a position
        stale_holdings = (
            db.query(Holding)
            .filter(
                Holding.account_id == account.id,
                Holding.security_id.notin_(list(holdings_data.keys())),
            )
            .delete(synchronize_session=False)
            if holdings_data
            else 0
        )
        if stale_holdings:
            logger.info(f"   Removed {stale_holdings} stale holdings")

        # Update or create holdings
        incomplete_history = 0
        for security_id, data in holdings_data.items():
            if data["shares"] < 0:
                # A negative share count is impossible in reality - it means the
                # opening buys fall outside the exported history window. Leave any
                # existing holding untouched rather than deleting a real position.
                incomplete_history += 1
                continue

            if data["shares"] == 0:
                # Genuinely closed out
                db.query(Holding).filter(
                    Holding.account_id == account.id, Holding.security_id == security_id
                ).delete()
                continue

            holding = (
                db.query(Holding)
                .filter(
                    Holding.account_id == account.id, Holding.security_id == security_id
                )
                .first()
            )

            # Rounding on proportional sell write-downs can push the basis a
            # fraction below zero; clamp so avg_cost never goes negative.
            remaining_cost = max(data["total_cost"], Decimal("0"))
            avg_cost = remaining_cost / data["shares"]

            if holding:
                holding.quantity = float(data["shares"])
                holding.avg_cost = float(avg_cost)
            else:
                holding = Holding(
                    account_id=account.id,
                    owner_id=current_user.id,
                    security_id=security_id,
                    quantity=float(data["shares"]),
                    avg_cost=float(avg_cost),
                    currency=current_user.currency,
                )
                db.add(holding)

        db.commit()
        logger.info(f"✓ Updated holdings for {len(holdings_data)} securities")
        if incomplete_history:
            logger.warning(
                f"   ⚠️ {incomplete_history} positions have buys older than the exported "
                "history window; their holdings were left unchanged"
            )

        # Step 6: Update dividends from DIVIDEND transactions
        logger.info("💰 Processing dividend transactions...")
        _progress("Processing dividends...")

        dividend_transactions = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.broker_name == "Trading212",
                Transaction.action_type == TransactionType.DIVIDEND,
            )
            .all()
        )

        dividends_added = 0
        for tx in dividend_transactions:
            # Check if dividend already exists using reference (external_id)
            existing_div = (
                db.query(Dividend)
                .filter(
                    Dividend.user_id == current_user.id,
                    Dividend.reference == tx.external_id,
                )
                .first()
            )

            if existing_div:
                continue

            dividend = Dividend(
                user_id=current_user.id,
                security_id=tx.security_id,
                account_id=account.id,
                transaction_id=tx.id,
                amount=float(tx.total_amount),
                currency=tx.total_currency,
                payment_date=tx.timestamp.date(),
                source="Trading212",
                ticker=tx.ticker,
                reference=tx.external_id,
                type="Cash",
            )
            db.add(dividend)
            dividends_added += 1

        db.commit()
        logger.info(f"✓ Added {dividends_added} dividend records")

        # Step 7: Update sync watermark.
        # Only advance it when the report actually yielded rows. A report that
        # parsed to nothing means the export did not really cover the window, and
        # moving the watermark forward would skip that period permanently - the
        # next delta sync starts after it and those events are never fetched again.
        if all_parsed_transactions:
            current_user.last_t212_sync_timestamp = time_to
            current_user.t212_sync_time_from = time_from
            current_user.t212_sync_time_to = time_to
            db.commit()
            logger.info("✓ Sync timestamp updated")
        else:
            logger.warning(
                "⚠️ Report contained no transactions - leaving the sync watermark "
                "untouched so this period is retried on the next sync"
            )

        # Build detailed status message
        status_message = f"Successfully synced {new_transactions} new transactions"
        if skipped_duplicates > 0:
            status_message += f" ({skipped_duplicates} duplicates skipped)"
        if not all_parsed_transactions:
            status_message = (
                "Trading 212 returned an empty report for this period. "
                "Nothing was imported and the next sync will retry the same window."
            )

        logger.info("=" * 60)
        logger.info(f"✅ {status_message}")
        logger.info(f"   💾 Transactions imported: {new_transactions}")
        logger.info(f"   ⏭️  Duplicates skipped: {skipped_duplicates}")
        logger.info(f"   📈 Holdings updated: {len(holdings_data)}")
        logger.info(f"   💰 Dividends added: {dividends_added}")
        logger.info("=" * 60)

        return {
            "status": "success",
            "message": status_message,
            "positions_updated": len(holdings_data),
            "cash_updated": 0.0,
            "dividends_updated": dividends_added,
            "transactions_imported": new_transactions,
            "transactions_skipped": skipped_duplicates,
            "unresolved_transactions": unresolved_positions,
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"❌ HTTP error: {e.response.status_code} - {e.response.text}")
        if e.response.status_code == 429:
            raise HTTPException(
                status_code=429, detail="Rate limited. Please wait 1 minute."
            )
        if e.response.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="Access denied. Please check your API Key permissions in Trading 212. You need 'History', 'Orders', and 'Metadata' scopes.",
            )
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Sync failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
