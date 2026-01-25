"""
ETF Holdings Service - Get underlying holdings of ETFs
Uses yfinance to fetch ETF constituents and weights
"""

import yfinance as yf
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

# Cache for ETF holdings to avoid repeated lookups
_etf_cache: Dict[str, List[Dict]] = {}


def get_etf_holdings(ticker: str) -> Optional[List[Dict]]:
    """
    Get underlying holdings of an ETF.
    
    Args:
        ticker: ETF ticker symbol (e.g., "SPY", "VUSA.L")
    
    Returns:
        List of holdings with ticker and weight, or None if not an ETF
        
    Example:
        >>> get_etf_holdings("SPY")
        [
            {"ticker": "AAPL", "weight": 0.07, "name": "Apple Inc."},
            {"ticker": "MSFT", "weight": 0.065, "name": "Microsoft"},
            ...
        ]
    """
    if ticker in _etf_cache:
        return _etf_cache[ticker]
    
    try:
        etf = yf.Ticker(ticker)
        info = etf.info
        
        # Check if it's an ETF
        if info.get('quoteType') not in ['ETF', 'MUTUALFUND']:
            return None
        
        # Get holdings - yfinance provides this in different ways
        holdings = []
        
        # Try to get holdings from the funds data
        try:
            funds_data = etf.funds_data
            if funds_data and hasattr(funds_data, 'asset_classes'):
                # This gives us sector allocation, not individual holdings
                pass
        except:
            pass
        
        # For major ETFs, we can use a predefined mapping
        # This is a simplified approach - in production, you'd use an ETF data API
        major_etfs = {
            "SPY": _get_sp500_top_holdings(),
            "VUSA.L": _get_sp500_top_holdings(),  # Vanguard S&P 500
            "QQQ": _get_nasdaq100_top_holdings(),
            "IWDA.L": _get_world_index_top_holdings(),
        }
        
        if ticker in major_etfs:
            holdings = major_etfs[ticker]
        else:
            # For other ETFs, return empty - they'll be treated as single securities
            logger.info(f"{ticker} is an ETF but holdings data not available")
            return []
        
        _etf_cache[ticker] = holdings
        return holdings
        
    except Exception as e:
        logger.error(f"Error getting ETF holdings for {ticker}: {e}")
        return None


def _get_sp500_top_holdings() -> List[Dict]:
    """Top 20 S&P 500 holdings with approximate weights"""
    return [
        {"ticker": "AAPL", "weight": 0.070, "name": "Apple Inc."},
        {"ticker": "MSFT", "weight": 0.065, "name": "Microsoft Corp."},
        {"ticker": "NVDA", "weight": 0.055, "name": "NVIDIA Corp."},
        {"ticker": "GOOGL", "weight": 0.035, "name": "Alphabet Inc."},
        {"ticker": "AMZN", "weight": 0.035, "name": "Amazon.com Inc."},
        {"ticker": "META", "weight": 0.025, "name": "Meta Platforms"},
        {"ticker": "BRK.B", "weight": 0.020, "name": "Berkshire Hathaway"},
        {"ticker": "TSLA", "weight": 0.020, "name": "Tesla Inc."},
        {"ticker": "JPM", "weight": 0.015, "name": "JPMorgan Chase"},
        {"ticker": "V", "weight": 0.012, "name": "Visa Inc."},
        # Add top 10 more major holdings
        {"ticker": "UNH", "weight": 0.011, "name": "UnitedHealth Group"},
        {"ticker": "XOM", "weight": 0.010, "name": "Exxon Mobil"},
        {"ticker": "MA", "weight": 0.010, "name": "Mastercard"},
        {"ticker": "JNJ", "weight": 0.009, "name": "Johnson & Johnson"},
        {"ticker": "PG", "weight": 0.009, "name": "Procter & Gamble"},
        {"ticker": "HD", "weight": 0.008, "name": "Home Depot"},
        {"ticker": "CVX", "weight": 0.008, "name": "Chevron"},
        {"ticker": "COST", "weight": 0.008, "name": "Costco"},
        {"ticker": "ABBV", "weight": 0.007, "name": "AbbVie"},
        {"ticker": "MRK", "weight": 0.007, "name": "Merck & Co."},
        # Remaining ~63% spread across 480 stocks
    ]


def _get_nasdaq100_top_holdings() -> List[Dict]:
    """Top 15 NASDAQ-100 holdings"""
    return [
        {"ticker": "AAPL", "weight": 0.130, "name": "Apple Inc."},
        {"ticker": "MSFT", "weight": 0.115, "name": "Microsoft Corp."},
        {"ticker": "NVDA", "weight": 0.090, "name": "NVIDIA Corp."},
        {"ticker": "AMZN", "weight": 0.070, "name": "Amazon.com Inc."},
        {"ticker": "META", "weight": 0.055, "name": "Meta Platforms"},
        {"ticker": "GOOGL", "weight": 0.045, "name": "Alphabet Inc."},
        {"ticker": "GOOG", "weight": 0.040, "name": "Alphabet Inc. (Class C)"},
        {"ticker": "TSLA", "weight": 0.040, "name": "Tesla Inc."},
        {"ticker": "AVGO", "weight": 0.025, "name": "Broadcom"},
        {"ticker": "COST", "weight": 0.020, "name": "Costco"},
    ]


def _get_world_index_top_holdings() -> List[Dict]:
    """Top holdings for global index (MSCI World)"""
    return [
        {"ticker": "AAPL", "weight": 0.050, "name": "Apple Inc."},
        {"ticker": "MSFT", "weight": 0.045, "name": "Microsoft Corp."},
        {"ticker": "NVDA", "weight": 0.035, "name": "NVIDIA Corp."},
        {"ticker": "AMZN", "weight": 0.025, "name": "Amazon.com Inc."},
        {"ticker": "GOOGL", "weight": 0.020, "name": "Alphabet Inc."},
        {"ticker": "META", "weight": 0.018, "name": "Meta Platforms"},
        {"ticker": "TSLA", "weight": 0.015, "name": "Tesla Inc."},
    ]


def is_etf(ticker: str) -> bool:
    """Check if a ticker is an ETF"""
    try:
        info = yf.Ticker(ticker).info
        return info.get('quoteType') in ['ETF', 'MUTUALFUND']
    except:
        return False
