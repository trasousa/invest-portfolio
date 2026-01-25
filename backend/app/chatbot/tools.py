from typing import List, Optional
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.models import models
from app.services.price_service import get_stock_info
import yfinance as yf

class StockSearchInput(BaseModel):
    query: str = Field(description="The stock symbol or company name to search for")

class StockSearchTool(BaseTool):
    name = "stock_market_search"
    description = "Get stock market data."
    args_schema: type[BaseModel] = StockSearchInput

    def _run(self, query: str):
        try:
            # Try to get info directly if it looks like a symbol
            info = get_stock_info(query)
            if info:
                return str(info)
            
            # Fallback to search
            ticker = yf.Ticker(query)
            info = ticker.info
            if 'symbol' in info:
                return str({
                    "symbol": info.get('symbol'),
                    "name": info.get('longName'),
                    "price": info.get('currentPrice') or info.get('regularMarketPrice'),
                    "sector": info.get('sector'),
                    "industry": info.get('industry'),
                    "description": info.get('longBusinessSummary')
                })
            return "No stock found."
        except Exception as e:
            return f"Error searching for stock: {str(e)}"

class PortfolioInput(BaseModel):
    user_id: int = Field(description="User ID")

class PortfolioTool(BaseTool):
    name: str = "get_user_portfolio"
    description: str = "Get user portfolio data including holdings, sector, industry, and market info."
    db: Session = Field(exclude=True)
    user_id: int = Field(exclude=True)

    class Config:
        arbitrary_types_allowed = True

    def _run(self, query: str = ""):
        # Fetch all holdings for the user directly
        holdings = self.db.query(models.Holding).filter(models.Holding.owner_id == self.user_id).all()
        
        portfolio_data = {
            "total_value": 0,
            "holdings": [],
            "summary_by_sector": {},
            "summary_by_market": {}
        }
        
        for holding in holdings:
            # Update price if needed (simplified here, ideally use price service)
            current_price = holding.security.current_price or 0.0
            market_value = holding.quantity * current_price
            
            portfolio_data["total_value"] += market_value
            
            # Sector aggregation
            sector = holding.security.sector or "Unknown"
            portfolio_data["summary_by_sector"][sector] = portfolio_data["summary_by_sector"].get(sector, 0) + market_value
            
            # Market aggregation
            market = holding.security.market or "Unknown"
            portfolio_data["summary_by_market"][market] = portfolio_data["summary_by_market"].get(market, 0) + market_value
            
            portfolio_data["holdings"].append({
                "symbol": holding.security.symbol,
                "name": holding.security.name,
                "quantity": holding.quantity,
                "avg_cost": holding.avg_cost,
                "current_price": current_price,
                "market_value": market_value,
                "gain_loss": market_value - (holding.quantity * holding.avg_cost),
                "sector": sector,
                "industry": holding.security.industry,
                "market": market,
                "currency": holding.security.currency
            })
            
        return str(portfolio_data)

class CashTool(BaseTool):
    name: str = "get_cash_transactions"
    description: str = "Get recent cash transactions and balances."
    db: Session = Field(exclude=True)
    user_id: int = Field(exclude=True)

    class Config:
        arbitrary_types_allowed = True

    def _run(self, limit: int = 10):
        transactions = self.db.query(models.CashTransaction).filter(
            models.CashTransaction.owner_id == self.user_id
        ).order_by(models.CashTransaction.date.desc()).limit(limit).all()
        
        balance = 0.0
        # Calculate total balance (simplified, ideally fetch from a pre-calculated source or sum all)
        all_txs = self.db.query(models.CashTransaction).filter(
            models.CashTransaction.owner_id == self.user_id
        ).all()
        for t in all_txs:
            if t.category == 'Savings':
                 # Savings logic handled in frontend, but for raw balance:
                 # If expense -> cash decreases. If income -> cash increases.
                 # Savings balance is separate.
                 pass
            
            if t.type == "income":
                balance += t.amount
            else:
                balance -= t.amount

        return str({
            "current_cash_balance": balance,
            "recent_transactions": [
                {
                    "date": t.date.isoformat(),
                    "type": t.type,
                    "category": t.category,
                    "amount": t.amount,
                    "description": t.description
                } for t in transactions
            ]
        })
