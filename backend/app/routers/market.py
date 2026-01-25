from fastapi import APIRouter, HTTPException
import yfinance as yf
from typing import List, Dict, Any
import datetime

router = APIRouter(prefix="/api/market", tags=["market"])

@router.get("/history/{ticker}")
def get_market_history(ticker: str, period: str = "1y") -> List[Dict[str, Any]]:
    """
    Fetch historical data for a ticker using yfinance.
    Tries common suffixes if direct ticker fails.
    """
    try:
        # 1. Try exact ticker
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)
        
        # 2. If empty and no suffix, try common European suffixes
        if hist.empty and "." not in ticker:
            suffixes = [".L", ".AS", ".DE", ".PA", ".MC"]
            for suffix in suffixes:
                print(f"Trying {ticker}{suffix}...")
                stock = yf.Ticker(f"{ticker}{suffix}")
                hist = stock.history(period=period)
                if not hist.empty:
                    break
        
        if hist.empty:
            print(f"No data found for {ticker}")
            return []

        data = []
        for date, row in hist.iterrows():
            data.append({
                "date": date.strftime("%Y-%m-%d"),
                "value": row["Close"]
            })
            
        return data
    except Exception as e:
        print(f"Market history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
