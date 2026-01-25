"""
Ticker normalization utilities.
Converts broker-specific tickers (especially Trading 212) to Yahoo Finance compatible tickers.
Uses a 3-tier approach:
1. Manual config file mappings (highest priority)
2. ISIN lookup via OpenFIGI (when available)
3. Algorithmic conversion (fallback)
"""

import os
import re

# Trading 212 ticker suffix mappings for algorithmic conversion
T212_SUFFIX_MAP = {
    "_US_EQ": "",  # US stocks (AAPL_US_EQ → AAPL)
    "l_EQ": ".L",   # London Stock Exchange (SPOTl_EQ → SPOT.L)
    "d_EQ": ".DE",  # German (Frankfurt) (DAId_EQ → DAI.DE)
    "a_EQ": ".AS",  # Amsterdam (ASMLa_EQ → ASML.AS)
    "s_EQ": ".SW",  # Swiss (NOVNs_EQ → NOVN.SW)
    "p_EQ": ".PA",  # Paris (AIRp_EQ → AIR.PA)
    "_EQ": "",      # Generic fallback
}

# Cache for manual ticker mappings
_manual_mappings = {}


def _load_ticker_mappings():
    """Load manual ticker mappings from config file"""
    global _manual_mappings
    
    if _manual_mappings:  # Already loaded
        return
    
    config_path = os.path.join(os.path.dirname(__file__), '../../ticker_mappings.conf')
    
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    # Split on = and strip comments from value
                    t212_ticker, yahoo_ticker = line.split('=', 1)
                    # Remove inline comments (anything after #)
                    yahoo_ticker = yahoo_ticker.split('#')[0].strip()
                    _manual_mappings[t212_ticker.strip()] = yahoo_ticker
    
    print(f"✓ Loaded {len(_manual_mappings)} manual ticker mappings")


# Load mappings on module import
_load_ticker_mappings()


def get_manual_isin_mapping(isin: str) -> str:
    """
    Get manual ticker mapping for a specific ISIN.
    Returns None if no manual mapping exists.
    """
    # ISIN mappings for problematic tickers
    # Format: ISIN -> Yahoo Ticker
    _isin_mappings = {
        # Rolls Royce - OpenFIGI returns RR/.L which is invalid
        "GB00B63H8491": "RR.L",
        
        # SAP - Should trade on US exchange, not Swiss
        "DE0007164600": "SAP",
        
        # German stocks that need corrections
        "DE0007100000": "MBG.DE",  # Mercedes-Benz
        "DE0005552004": "DPW.DE",  # Deutsche Post
        "DE0005190003": "BMW.DE",  # BMW
        
        # Baidu - sometimes comes as BIDUN
        "US0567521085": "BIDU",
    }
    
    return _isin_mappings.get(isin)


def normalize_ticker(ticker: str, source: str = "Trading212") -> str:
    """
    Normalize a ticker from any brokerage to Yahoo Finance format.
    
    Priority:
    1. Check manual config mappings (fastest)
    2. Use algorithmic conversion (fallback)
    Note: ISIN lookup is done in sync endpoint when ISIN is available
    
    Args:
        ticker: Original ticker (e.g., "AAPL_US_EQ" from Trading 212)
        source: Source brokerage ("Trading212", "IBKR", etc.)
    
    Returns:
        Yahoo Finance compatible ticker
        
    Examples:
        >>> normalize_ticker("AAPL_US_EQ", "Trading212")
        'AAPL'
        >>> normalize_ticker("SAP_EQ", "Trading212")  # From config
        'SAP.DE'
    """
    # Priority 1: Check manual mappings (O(1) lookup)
    if ticker in _manual_mappings:
        return _manual_mappings[ticker]
        
    # Priority 1.5: Check if ticker + "_EQ" is in manual mappings (e.g. BY6 -> BY6_EQ)
    if f"{ticker}_EQ" in _manual_mappings:
        return _manual_mappings[f"{ticker}_EQ"]
    
    # Priority 2: Algorithmic conversion for Trading 212
    if source == "Trading212":
        return extract_ticker_from_t212(ticker)
    
    return ticker


def extract_ticker_from_t212(t212_ticker: str) -> str:
    """
    Extract Yahoo Finance ticker from Trading 212 format using algorithmic conversion.
    
    Args:
        t212_ticker: Trading 212 ticker format
    
    Returns:
        Yahoo Finance ticker
        
    Examples:
        >>> extract_ticker_from_t212("AAPL_US_EQ")
        'AAPL'
        >>> extract_ticker_from_t212("SPOTl_EQ")
        'SPOT.L'
    """
    # Try each suffix mapping in order of specificity
    for suffix, replacement in T212_SUFFIX_MAP.items():
        if t212_ticker.endswith(suffix):
            # Remove the suffix and add the replacement
            base_ticker = t212_ticker[:-len(suffix)]
            return base_ticker + replacement
    
    # If no known suffix, return original
    return t212_ticker


if __name__ == "__main__":
    # Test the normalization
    test_tickers = [
        "AAPL_US_EQ",
        "AMZN_US_EQ", 
        "GOOGL_US_EQ",
        "SPOTl_EQ",  # Spotify UK
        "DAId_EQ",   # Daimler Germany
        "ASMLa_EQ",  # ASML Netherlands
        "NOVNs_EQ",  # Novartis Swiss
        "AIRp_EQ",   # Airbus Paris
        "SAP_EQ",    # Should use config mapping
    ]
    
    print("Trading 212 Ticker Normalization Test:\n")
    for ticker in test_tickers:
        normalized = normalize_ticker(ticker, "Trading212")
        print(f"{ticker:20} → {normalized}")
