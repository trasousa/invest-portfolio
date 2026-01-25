# pyright: reportGeneralTypeIssues=false

from collections import defaultdict
from decimal import Decimal
from typing import Dict

# pyright: reportGeneralTypeIssues=false

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core import database
from app.models import models
from app.routers.auth import get_current_user
from app.routers.portfolio_helpers import _get_sector_for_ticker
from app.schemas import PortfolioSummary
from app.services.price_service import (
    get_cached_price,
    get_cached_quote,
    get_exchange_rate,
    update_prices_batch,
)
import datetime

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/summary", response_model=PortfolioSummary)
def get_summary(
    force_refresh: bool = False,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        # Fetch all holdings directly
        holdings = current_user.holdings
        user_currency = current_user.currency or "USD"
        exchange_rate = 1.0

        # Get exchange rate if not USD
        if user_currency != "USD":
            exchange_rate = get_exchange_rate(user_currency)

        total_value = 0.0
        total_cost = 0.0
        total_annual_income = 0.0

        # Collect symbols to update
        symbols_to_update = []
        for holding in holdings:
            # Only update prices for stocks and crypto
            sec_type = (holding.security.type or "stock").lower()
            if sec_type in ["stock", "crypto", "etf", "fund", "cryptocurrency"]:
                # Update if forced OR cache expired
                if force_refresh or not get_cached_price(holding.security.symbol):
                    symbols_to_update.append(holding.security.symbol)

        if symbols_to_update:
            try:
                updates = update_prices_batch(symbols_to_update)
                # Update DB records
                for symbol, data in updates.items():
                    security = (
                        db.query(models.Security)
                        .filter(models.Security.symbol == symbol)
                        .first()
                    )
                    if security:
                        security.current_price = data["price"]
                        security.sector = data.get("sector")
                        security.industry = data.get("industry")
                        security.dividend_yield = data.get("dividend_yield", 0)
                        security.last_updated = datetime.datetime.now()
                db.commit()
            except Exception as e:
                print(f"Error updating prices: {e}")
                pass

        # Calculate Cash Balance (from transactions)
        cash_transactions = (
            db.query(models.CashTransaction)
            .filter(models.CashTransaction.owner_id == current_user.id)
            .all()
        )
        cash_balance = 0.0
        for t in cash_transactions:
            if t.type == "income":
                cash_balance += t.amount
            else:
                cash_balance -= t.amount

        # Calculate Debts
        debts = (
            db.query(models.Debt).filter(models.Debt.owner_id == current_user.id).all()
        )
        total_debt = sum(d.principal for d in debts)

        # Calculate Holdings Value
        for holding in holdings:
            quote = get_cached_quote(holding.security.symbol)
            price = (
                (quote["price"] if quote else None)
                or holding.security.current_price
                or 0.0
            )

            # Determine holding currency (prefer quote currency)
            price_currency = quote.get("currency") if quote else None
            holding_currency = holding.currency or user_currency or "USD"

            rate_value = get_exchange_rate(
                price_currency or holding_currency, user_currency
            )
            rate_cost = get_exchange_rate(holding_currency, user_currency)

            value = holding.quantity * price * rate_value
            cost = holding.quantity * holding.avg_cost * rate_cost

            total_value += value
            total_cost += cost

            # Dividend Income (yield is %, so income is value * yield)
            div_yield = holding.security.dividend_yield or 0
            annual_income = value * div_yield
            total_annual_income += annual_income

        # Add Cash Balance to Total Value (Convert cash to user currency)
        # Assuming cash transactions are in USD for now, or we need a currency field there too.
        # For simplicity, let's assume cash is in User's currency or USD.
        # If we want to support multi-currency cash, we need to update CashTransaction model.
        # For now, let's assume cash is in USD and convert to User Currency.
        cash_rate = get_exchange_rate("USD", user_currency)
        total_value += cash_balance * cash_rate

        # Net Worth = Total Assets - Total Debt
        # Assuming Debt is in USD
        total_assets = (
            total_value  # At this point total_value includes all assets + cash
        )
        total_value -= total_debt * cash_rate

        dividend_yield = (
            (total_annual_income / total_value * 100) if total_value > 0 else 0
        )
        yield_on_cost = (
            (total_annual_income / total_cost * 100) if total_cost > 0 else 0
        )

        # Snapshot history
        today = datetime.date.today()
        history = (
            db.query(models.PortfolioHistory)
            .filter(
                models.PortfolioHistory.user_id == current_user.id,
                models.PortfolioHistory.date == today,
            )
            .first()
        )

        if not history:
            history = models.PortfolioHistory(
                user_id=current_user.id, date=today, total_value=total_value
            )
            db.add(history)
            db.commit()
        elif abs(history.total_value - total_value) > 0.01:
            history.total_value = total_value
            db.commit()

        return PortfolioSummary(
            total_value=round(total_value, 2),
            total_assets=round(total_assets, 2),
            total_debt=round(total_debt * cash_rate, 2),
            annual_income=round(total_annual_income, 2),
            dividend_yield=round(dividend_yield, 2),
            yield_on_cost=round(yield_on_cost, 2),
        )
    except Exception as e:
        print(f"Error generating portfolio summary: {e}")
        return PortfolioSummary(
            total_value=0.0, annual_income=0.0, dividend_yield=0.0, yield_on_cost=0.0
        )


@router.get("/history")
def get_history(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    history = (
        db.query(models.PortfolioHistory)
        .filter(models.PortfolioHistory.user_id == current_user.id)
        .order_by(models.PortfolioHistory.date)
        .all()
    )

    invested_timeline = _build_invested_timeline(db, current_user)

    results = []
    last_invested = 0.0
    for entry in history:
        invested = invested_timeline.get(entry.date, last_invested)
        if invested == 0.0 and entry.total_value > 0:
            invested = entry.total_value
        last_invested = invested
        gain = entry.total_value - invested
        gain_percent = (gain / invested * 100) if invested else 0.0
        results.append(
            {
                "date": entry.date.isoformat(),
                "value": round(entry.total_value, 2),
                "invested": round(invested, 2),
                "gain": round(gain, 2),
                "gain_percent": round(gain_percent, 2),
            }
        )

    return results


def _build_invested_timeline(
    db: Session, current_user: models.User
) -> Dict[datetime.date, float]:
    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current_user.id)
        .order_by(models.Transaction.timestamp)
        .all()
    )

    user_currency = (current_user.currency or "USD").upper()
    rate_cache: Dict[str, float] = {f"{user_currency}->{user_currency}": 1.0}

    def convert(amount: Decimal, source_currency: str | None) -> float:
        currency = (source_currency or user_currency).upper()
        key = f"{currency}->{user_currency}"
        if key not in rate_cache:
            rate_cache[key] = get_exchange_rate(currency, user_currency)
        normalized = float(amount or Decimal("0"))
        return normalized * rate_cache[key]

    inflow_types = {
        models.TransactionType.BUY,
        models.TransactionType.DEPOSIT,
        models.TransactionType.TRANSFER,
    }
    outflow_types = {
        models.TransactionType.SELL,
        models.TransactionType.WITHDRAWAL,
    }

    timeline: Dict[datetime.date, float] = {}
    cumulative = 0.0
    for tx in transactions:
        if not tx.total_amount or not tx.timestamp:
            continue
        action = tx.action_type
        if action not in inflow_types and action not in outflow_types:
            continue

        normalized_amount = convert(tx.total_amount, tx.total_currency)
        if action in inflow_types:
            cumulative += normalized_amount
        else:
            cumulative -= normalized_amount

        timeline[tx.timestamp.date()] = cumulative

    return timeline


@router.get("/diversification")
def get_diversification(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    holdings = current_user.holdings

    from app.services.etf_service import get_etf_holdings, is_etf

    total_value = 0.0
    sector_alloc = {}
    industry_alloc = {}
    market_alloc = {}

    for holding in holdings:
        price = (
            get_cached_price(holding.security.symbol) or holding.security.current_price
        )
        value = holding.quantity * price

        # Check if this is an ETF and should be broken down
        etf_holdings = get_etf_holdings(holding.security.symbol)

        if etf_holdings:
            # This is an ETF with known holdings - break it down
            for constituent in etf_holdings:
                constituent_value = value * constituent["weight"]

                # Use simplified sector mapping
                sector = _get_sector_for_ticker(constituent["ticker"])
                industry = constituent.get("industry", "Technology")  # Simplified

                sector_alloc[sector] = sector_alloc.get(sector, 0) + constituent_value
                industry_alloc[industry] = (
                    industry_alloc.get(industry, 0) + constituent_value
                )
                total_value += constituent_value
        else:
            # Regular stock or ETF without breakdown
            sector = holding.security.sector or "Unknown"
            industry = holding.security.industry or "Unknown"

            sector_alloc[sector] = sector_alloc.get(sector, 0) + value
            industry_alloc[industry] = industry_alloc.get(industry, 0) + value
            total_value += value

    # Add Cash Balance to Diversification (as a sector)
    cash_transactions = (
        db.query(models.CashTransaction)
        .filter(models.CashTransaction.owner_id == current_user.id)
        .all()
    )
    cash_balance = 0.0
    for t in cash_transactions:
        if t.type == "income":
            cash_balance += t.amount
        else:
            cash_balance -= t.amount

    if cash_balance > 0:
        total_value += cash_balance
        sector_alloc["Cash & Equivalents"] = (
            sector_alloc.get("Cash & Equivalents", 0) + cash_balance
        )

    sectors = [
        {
            "name": k,
            "value": round(v, 2),
            "percentage": round((v / total_value) * 100, 2) if total_value > 0 else 0,
        }
        for k, v in sector_alloc.items()
    ]
    industries = [
        {
            "name": k,
            "value": round(v, 2),
            "percentage": round((v / total_value) * 100, 2) if total_value > 0 else 0,
        }
        for k, v in industry_alloc.items()
    ]

    return {
        "total_value": round(total_value, 2),
        "sectors": sorted(sectors, key=lambda x: x["value"], reverse=True),
        "industries": sorted(industries, key=lambda x: x["value"], reverse=True),
    }
