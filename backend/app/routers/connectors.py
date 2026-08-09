# pyright: reportGeneralTypeIssues=false

import logging
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.brokerage.trading212.service import Trading212Service
from app.core.database import get_db
from app.core.security import decrypt_string, encrypt_string
from app.models.models import Account, AccountType, Holding, Security, User
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
    positions_updated: int
    cash_updated: float
    dividends_updated: int


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


@router.post("/trading212/sync", response_model=SyncResponse)
async def sync_trading212(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Sync portfolio from Trading212 using CSV historical reports only.

    - First sync: Fetches 7 years of history
    - Subsequent syncs: Fetches only new data since last sync
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

    try:
        from datetime import datetime, timedelta, date
        import httpx
        import asyncio
        from decimal import Decimal
        from app.utils.t212_csv_parser import parse_t212_csv
        from app.models.models import (
            Transaction,
            SecurityHistory,
            Dividend,
            Security,
            Account,
            Holding,
            TransactionType,
        )
        from app.utils.isin_resolver import get_ticker_from_isin

        logger.info("=" * 60)
        logger.info("🚀 Starting Trading 212 Sync")
        logger.info("=" * 60)

        # Step 1: Determine date range for CSV report
        logger.info("📅 Determining sync date range...")

        is_first_sync = current_user.last_t212_sync_timestamp is None
        if is_first_sync:
            # First sync - fetch up to 5 years of history (T212 typically supports this in one report)
            time_from = datetime.now() - timedelta(days=365 * 5)
            logger.info(f"   First sync - fetching up to 5 years of history")
        else:
            # Subsequent sync - from last sync to now, with 1 day overlap to be safe
            time_from = current_user.last_t212_sync_timestamp - timedelta(days=1)
            logger.info(f"   Delta sync - fetching since {time_from}")

        time_to = datetime.now()

        # Step 2: Request report
        time_from_str = time_from.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        time_to_str = time_to.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        logger.info(f"📥 Requesting historical report...")
        logger.info(f"   Period: {time_from.date()} to {time_to.date()}")

        try:
            # We try to use a wider range for the first sync
            # T212 API sometimes limits the duration of reports, but 5 years usually works.
            # If it fails, we catch it.
            report_id = await service.request_historical_report(
                time_from_str, time_to_str
            )
            logger.info(f"   ✓ Report {report_id} requested successfully")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logger.error("   ❌ Rate limited - too many recent requests")
                raise HTTPException(
                    status_code=429,
                    detail="Rate limited. Trading 212 allows 1 report request per 30-60 seconds. Please wait and try again.",
                )
            if is_first_sync and e.response.status_code == 400:
                # If 5 years is too long, try 1 year
                logger.warning("   ⚠️ 5 year report failed, trying 1 year...")
                time_from = datetime.now() - timedelta(days=365)
                time_from_str = time_from.isoformat() + "Z"
                report_id = await service.request_historical_report(
                    time_from_str, time_to_str
                )
            else:
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
        with open(csv_filepath, "r") as f:
            csv_content = f.read()

        all_parsed_transactions = parse_t212_csv(csv_content)
        logger.info(f"   ✓ Parsed {len(all_parsed_transactions)} transactions")

        # Step 4: Import transactions with deduplication
        logger.info("💾 Importing transactions...")
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

        # Calculate holdings from all transactions
        from collections import defaultdict
        from decimal import Decimal

        holdings_data = defaultdict(
            lambda: {"shares": Decimal("0"), "total_cost": Decimal("0")}
        )

        # Get all buy/sell transactions for this user
        buy_sell_transactions = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.broker_name == "Trading212",
                Transaction.action_type.in_(
                    [TransactionType.BUY, TransactionType.SELL]
                ),
            )
            .order_by(Transaction.timestamp)
            .all()
        )

        for tx in buy_sell_transactions:
            if not tx.security_id:
                continue

            if tx.action_type == TransactionType.BUY:
                holdings_data[tx.security_id]["shares"] += tx.shares or Decimal("0")
                holdings_data[tx.security_id]["total_cost"] += (
                    tx.total_amount or Decimal("0")
                )
            elif tx.action_type == TransactionType.SELL:
                holdings_data[tx.security_id]["shares"] -= tx.shares or Decimal("0")
                # Calculate realized P/L (optional, can add later)

        # Update or create holdings
        for security_id, data in holdings_data.items():
            if data["shares"] <= 0:
                # Remove holding if sold all shares
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

            avg_cost = (
                data["total_cost"] / data["shares"]
                if data["shares"] > 0
                else Decimal("0")
            )

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

        # Step 6: Update dividends from DIVIDEND transactions
        logger.info("💰 Processing dividend transactions...")

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

        # Step 7: Update sync timestamp
        current_user.last_t212_sync_timestamp = datetime.now()
        current_user.t212_sync_time_from = (
            time_from
            if isinstance(time_from, datetime)
            else datetime.fromisoformat(time_from.replace("Z", ""))
        )
        current_user.t212_sync_time_to = (
            time_to if isinstance(time_to, datetime) else datetime.now()
        )
        db.commit()
        logger.info("✓ Sync timestamp updated")

        # Build detailed status message
        status_message = f"Successfully synced {new_transactions} new transactions"
        if skipped_duplicates > 0:
            status_message += f" ({skipped_duplicates} duplicates skipped)"
        if len(all_parsed_transactions) == 0:
            status_message = "Sync completed but no transactions found (possibly rate limited or empty period)"

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
