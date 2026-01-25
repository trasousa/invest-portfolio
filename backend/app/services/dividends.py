from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import datetime, timedelta
from app.models.models import Dividend, Holding, User
import yfinance as yf
import logging

logger = logging.getLogger(__name__)

FREQUENCY_HINTS = {
    "monthly": 12,
    "Monthly": 12,
    "quarterly": 4,
    "Quarterly": 4,
    "semiannual": 2,
    "semi-annual": 2,
    "SemiAnnual": 2,
    "annual": 1,
    "Annual": 1,
}

class DividendService:
    def __init__(self, db: Session, user: User):
        self.db = db
        self.user = user

    async def get_dividend_timeline(self) -> Dict[str, Any]:
        """
        Get dividend timeline from database.
        Returns historical dividends plus projected future dividends.
        """
        # Get historical dividends from database
        historical_divs = self.db.query(Dividend).filter(
            Dividend.user_id == self.user.id
        ).order_by(Dividend.payment_date.desc()).limit(100).all()
        
        historical_events = []
        
        # Convert to timeline format
        for div in historical_divs:
            security = div.security
            historical_events.append({
                "date": div.payment_date.strftime("%Y-%m-%d"),
                "symbol": security.symbol if security else div.original_ticker,
                "name": security.name if security else div.original_ticker,
                "amount": float(div.amount),
                "currency": div.currency,
                "type": "historical"
            })
        
        # Project Future Dividends based on Holdings
        holdings = self.db.query(Holding).filter(Holding.owner_id == self.user.id).all()
        projected_events = []
        today = datetime.now()
        
        total_portfolio_value = 0.0
        total_cost_basis = 0.0
        total_annual_income = 0.0
        
        for h in holdings:
            if not h.security or not h.security.dividend_yield:
                continue
            
            # Calculate portfolio values for accurate yield calculations
            holding_value = h.quantity * (h.security.current_price or 0)
            total_portfolio_value += holding_value
            total_cost_basis += h.quantity * (h.avg_cost or h.security.current_price or 0)
            
            # Get actual dividend frequency from yfinance if available
            payments_per_year = 4
            try:
                ticker = yf.Ticker(h.security.symbol)
                info = ticker.info
                payments_per_year = _determine_payments_per_year(ticker, info)
            except:
                logger.debug("Unable to fetch dividend frequency for %s", h.security.symbol)
            
            # Calculate annual amount = Value * Yield
            annual_amount = (
                h.quantity
                * (h.security.current_price or 0)
                * h.security.dividend_yield
            )
            total_annual_income += annual_amount
            
            # Calculate actual dividend payments based on frequency
            payments_per_year = max(1, payments_per_year)
            actual_amount = annual_amount / payments_per_year if payments_per_year else 0
            payment_interval = 365 // payments_per_year
            
            # Project next 12 months
            payments_count = payments_per_year
            for i in range(payments_count):
                date = today + timedelta(days=payment_interval * (i + 1))
                projected_events.append({
                    "id": f"proj-{h.id}-{i}",
                    "date": date.strftime("%Y-%m-%d"),
                    "ticker": h.security.symbol,
                    "name": h.security.name,
                    "amount": actual_amount,
                    "status": "forecasted",
                    "source": "Projection"
                })
        
        # Sort events
        historical_events.sort(key=lambda x: x["date"], reverse=True) # Newest first
        projected_events.sort(key=lambda x: x["date"]) # Soonest first
        
        # Calculate Monthly Breakdown (Future)
        monthly_breakdown = {}
        for event in projected_events:
            month_key = event["date"][:7] # YYYY-MM
            monthly_breakdown[month_key] = monthly_breakdown.get(month_key, 0) + event["amount"]
            
        monthly_data = [{"month": k, "amount": v} for k, v in monthly_breakdown.items()]
        monthly_data.sort(key=lambda x: x["month"])

        # Calculate portfolio yield metrics
        portfolio_yield = (
            total_annual_income / total_portfolio_value
            if total_portfolio_value > 0
            else 0
        )
        yield_on_cost = (
            total_annual_income / total_cost_basis if total_cost_basis > 0 else 0
        )

        return {
            "history": historical_events,
            "projected": projected_events,
            "monthly_breakdown": monthly_data,
            "stats": {
                "annual_income": total_annual_income,
                "yield_on_cost": yield_on_cost,
                "portfolio_yield": portfolio_yield
            }
        }


def _determine_payments_per_year(ticker: yf.Ticker, info: Dict[str, Any]) -> int:
    hint = info.get("dividendPaymentFrequency") or info.get("dividendFrequency")
    if hint and hint in FREQUENCY_HINTS:
        return FREQUENCY_HINTS[hint]

    try:
        dividends = ticker.dividends
        if dividends.empty:
            return 4
        cutoff = datetime.now() - timedelta(days=365)
        recent = dividends[dividends.index >= cutoff]
        count = len(recent) or len(dividends.tail(4))
        if count >= 11:
            return 12
        if count >= 3:
            return 4
        if count == 2:
            return 2
        return 1
    except Exception:
        return 4
