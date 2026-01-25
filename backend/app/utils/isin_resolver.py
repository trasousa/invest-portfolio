"""
ISIN to Ticker resolver using OpenFIGI API.
Provides accurate ticker resolution for Trading 212 instruments.
"""

import httpx
from typing import Optional, Dict
import json

# Cache for ISIN -> ticker mappings to avoid repeated API calls
_isin_cache: Dict[str, str] = {}

async def get_ticker_from_isin(isin: str) -> Optional[str]:
    """
    Resolve ISIN to Yahoo Finance compatible ticker using OpenFIGI API.
    
    Args:
        isin: ISIN code (e.g., "US0378331005" for Apple)
    
    Returns:
        Yahoo Finance ticker (e.g., "AAPL") or None if not found
    
    Examples:
        >>> await get_ticker_from_isin("US0378331005")
        'AAPL'
        >>> await get_ticker_from_isin("LU1781541179")
        'VUSA.L'
    """
    # Check cache first
    if isin in _isin_cache:
        return _isin_cache[isin]
    
    # Check manual ISIN mappings (highest priority)
    # This allows us to override automatic resolution for problematic tickers
    from app.utils.ticker_utils import get_manual_isin_mapping
    manual_ticker = get_manual_isin_mapping(isin)
    if manual_ticker:
        _isin_cache[isin] = manual_ticker
        print(f"Resolved ISIN {isin} → {manual_ticker} (manual mapping)")
        return manual_ticker
    
    try:
        async with httpx.AsyncClient() as client:
            # OpenFIGI API - free, no key required for basic use
            response = await client.post(
                "https://api.openfigi.com/v3/mapping",
                json=[{"idType": "ID_ISIN", "idValue": isin}],
                headers={"Content-Type": "application/json"},
                timeout=10.0
            )
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            
            if not data or not data[0].get("data"):
                return None
            
            # Get the first result
            result = data[0]["data"][0]
            
            # Try to get ticker and exchange
            ticker = result.get("ticker")
            exchange = result.get("exchCode", "")
            
            if not ticker:
                return None
            
            # Map exchange codes to Yahoo Finance suffixes
            exchange_map = {
                # US exchanges
                "US": "",
                "UN": "",
                "UW": "",
                "UR": "",
                "PE": "",  # NYSE Arca
                "MM": "",  # NASDAQ
                "CN": "",  # Canadian but often available as US ticker
                
                # London
                "LN": ".L",
                "UQ": ".L",
                
                # Germany
                "GR": ".DE",
                "GY": ".DE",
                "GF": ".DE",
                "FH": ".DE",
                
                # Amsterdam
                "AS": ".AS",
                "NA": ".AS",
                
                # Swiss
                "SW": ".SW",
                "SE": ".SW",
                "VX": ".SW",
                
                # Paris
                "FP": ".PA",
                "PA": ".PA",
                
                # Spain
                "SM": ".MC",
                
                # Italy
                "IM": ".MI",
                
                # Nordic
                "SS": ".ST",  # Stockholm
                "DC": ".CO",  # Copenhagen
                "NO": ".OL",  # Oslo
                
                # Australia
                "AU": "",  # Australian stocks on Yahoo don't need suffix
            }
            
            suffix = exchange_map.get(exchange, "")
            yahoo_ticker = f"{ticker}{suffix}"
            
            # CRITICAL: Sanitize ticker - remove invalid characters like /
            # Yahoo Finance doesn't accept slashes in tickers
            yahoo_ticker = yahoo_ticker.replace("/", "")
            
            # Log successful resolution
            print(f"Resolved ISIN {isin} → {yahoo_ticker} (exchange: {exchange})")

            
            # Cache the result
            _isin_cache[isin] = yahoo_ticker
            
            return yahoo_ticker
            
    except Exception as e:
        print(f"Error resolving ISIN {isin}: {e}")
        return None


def get_ticker_from_isin_sync(isin: str) -> Optional[str]:
    """Synchronous wrapper for get_ticker_from_isin."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(get_ticker_from_isin(isin))


if __name__ == "__main__":
    # Test with known ISINs
    import asyncio
    
    async def test():
        test_cases = [
            ("US0378331005", "AAPL"),  # Apple
            ("US02079K3059", "GOOGL"),  # Alphabet
            ("LU1781541179", "VUSA.L"),  # Vanguard S&P 500 ETF
            ("NL0010273215", "ASML.AS"),  # ASML
        ]
        
        print("Testing ISIN lookup:\n")
        for isin, expected in test_cases:
            ticker = await get_ticker_from_isin(isin)
            status = "✓" if ticker == expected else "✗"
            print(f"{status} {isin} → {ticker} (expected: {expected})")
    
    asyncio.run(test())
