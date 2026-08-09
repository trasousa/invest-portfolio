import logging
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from typing import Dict, List, Optional

import httpx
import yfinance as yf

from app.services.stock_providers import (
    AlphaVantageProvider,
    StockData,
    YFinanceProvider,
)
from app.utils.ticker_utils import normalize_ticker

logger = logging.getLogger(__name__)

# Simple in-memory cache: {symbol: {'price': float, 'timestamp': float}}
PRICE_CACHE: Dict[str, Dict] = {}
CACHE_DURATION = 900  # 15 minutes

# Track symbols that failed recently to avoid hammering providers
FAILED_SYMBOLS: Dict[str, float] = {}
FAILED_TTL = 6 * 3600  # 6 hours

# Exchange Rate Cache: {'EUR->USD': {'rate': 0.92, 'timestamp': 12345}}
EXCHANGE_RATES: Dict[str, Dict] = {}
EXCHANGE_TTL = 3600  # 1 hour
FRANKFURTER_URL = "https://api.frankfurter.app/latest"

_PROVIDERS = [YFinanceProvider(), AlphaVantageProvider()]


# Some exchanges quote in a minor unit: Yahoo returns London prices as GBp
# (pence), Tel Aviv as ILA (agorot) and Johannesburg as ZAc (cents). Uppercasing
# "GBp" turns it into "GBP", so a pence price is treated as pounds and the
# holding is valued 100x too high; an unrecognised code is worse still, because
# the lookup fails and falls back to a rate of 1.0.
_MINOR_UNIT_CURRENCIES = {
    "GBP": ("GBP", 0.01),  # matched case-sensitively as "GBp"
    "GBX": ("GBP", 0.01),
    "ILA": ("ILS", 0.01),
    "ZAC": ("ZAR", 0.01),
}


def resolve_currency(code: str) -> tuple:
    """
    Return (major currency code, factor) for a possibly minor-unit code.

    One unit of the given code equals `factor` units of the major currency, so
    GBp -> ("GBP", 0.01) and EUR -> ("EUR", 1.0).
    """
    raw = (code or "").strip()
    if not raw:
        return "USD", 1.0

    # "GBp" is only distinguishable from "GBP" before uppercasing
    if raw == "GBp":
        return _MINOR_UNIT_CURRENCIES["GBP"]

    upper = raw.upper()
    if upper in ("GBX", "ILA", "ZAC"):
        return _MINOR_UNIT_CURRENCIES[upper]

    return upper, 1.0


def get_exchange_rate(from_currency: str, to_currency: str = "USD") -> float:
    from_currency, from_factor = resolve_currency(from_currency)
    to_currency, to_factor = resolve_currency(to_currency)

    # Converts between the minor and major units on either side (e.g. pence -> pounds)
    unit_scale = from_factor / to_factor

    if from_currency == to_currency:
        return unit_scale

    return _major_unit_rate(from_currency, to_currency) * unit_scale


def _major_unit_rate(from_currency: str, to_currency: str) -> float:
    pair_key = f"{from_currency}->{to_currency}"
    cached = EXCHANGE_RATES.get(pair_key)
    if cached and (time.time() - cached["timestamp"] < EXCHANGE_TTL):
        return cached["rate"]

    rate = _fetch_direct_rate(from_currency, to_currency)
    if rate:
        _cache_rate(pair_key, rate)
        return rate

    rate = _fetch_frankfurter_rate(from_currency, to_currency)
    if rate:
        _cache_rate(pair_key, rate)
        return rate

    if from_currency != "USD" and to_currency != "USD":
        usd_cross = _fetch_cross_rate(from_currency, to_currency)
        if usd_cross:
            _cache_rate(pair_key, usd_cross)
            return usd_cross

    logger.warning(
        "Falling back to 1.0 exchange rate for %s -> %s", from_currency, to_currency
    )
    return 1.0


def get_stock_info(symbol: str) -> Optional[Dict]:
    symbol = symbol.upper().strip()
    if not symbol:
        return None

    if _should_skip_symbol(symbol):
        return None

    # 1. Try normalized ticker first
    normalized_symbol = normalize_ticker(symbol)
    if normalized_symbol != symbol and _should_skip_symbol(normalized_symbol):
        normalized_symbol = symbol

    stock_data = _fetch_from_providers(normalized_symbol)

    # 2. Fallback to original if normalized failed and they are different
    if not stock_data and normalized_symbol != symbol:
        stock_data = _fetch_from_providers(symbol)

    if not stock_data:
        _mark_symbol_failed(symbol)
        if normalized_symbol != symbol:
            _mark_symbol_failed(normalized_symbol)
        return None

    record = asdict(stock_data)
    # Cache using the ORIGINAL symbol so lookups work
    _cache_price(symbol, record)
    return record


def update_prices_batch(symbols: List[str]) -> Dict[str, Dict]:
    unique_symbols = list({(s or "").upper() for s in symbols if s})
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(lambda s: (s, get_stock_info(s)), unique_symbols))

    return {symbol: data for symbol, data in results if data}


def get_cached_quote(symbol: str) -> Optional[Dict]:
    cached = PRICE_CACHE.get(symbol.upper())
    if cached and (time.time() - cached["timestamp"] < CACHE_DURATION):
        return cached
    if symbol in PRICE_CACHE:
        PRICE_CACHE.pop(symbol, None)
    return None


def get_cached_price(symbol: str) -> Optional[float]:
    quote = get_cached_quote(symbol)
    return quote["price"] if quote else None


def _fetch_from_providers(symbol: str) -> Optional[StockData]:
    symbol = symbol.upper().strip()
    if not symbol:
        return None
    for provider in _PROVIDERS:
        if not provider.is_available():
            continue
        data = provider.get_stock_info(symbol)
        if data:
            if data.dividend_yield is None:
                data.dividend_yield = 0.0
            return data
    return None


def _cache_price(symbol: str, data: Dict) -> None:
    PRICE_CACHE[symbol] = {
        "price": data["price"],
        "currency": data.get("currency", "USD"),
        "timestamp": time.time(),
        "dividend_yield": data.get("dividend_yield", 0.0),
    }


def _should_skip_symbol(symbol: str) -> bool:
    key = symbol.upper()
    failed_at = FAILED_SYMBOLS.get(key)
    if not failed_at:
        return False
    if time.time() - failed_at < FAILED_TTL:
        return True
    FAILED_SYMBOLS.pop(key, None)
    return False


def _mark_symbol_failed(symbol: str) -> None:
    FAILED_SYMBOLS[symbol.upper()] = time.time()


def _fetch_direct_rate(from_currency: str, to_currency: str) -> Optional[float]:
    pair = f"{from_currency}{to_currency}=X"
    try:
        ticker = yf.Ticker(pair)
        rate = ticker.fast_info.last_price
        if rate:
            return float(rate)

        inverse_pair = f"{to_currency}{from_currency}=X"
        ticker = yf.Ticker(inverse_pair)
        inverse_rate = ticker.fast_info.last_price
        if inverse_rate:
            return 1.0 / float(inverse_rate)
    except Exception as exc:  # pragma: no cover - network access
        logger.debug(
            "yfinance exchange rate fetch failed for %s -> %s: %s",
            from_currency,
            to_currency,
            exc,
        )
    return None


def _fetch_frankfurter_rate(from_currency: str, to_currency: str) -> Optional[float]:
    try:
        response = httpx.get(
            FRANKFURTER_URL,
            params={"amount": 1, "from": from_currency, "to": to_currency},
            timeout=10.0,
        )
        response.raise_for_status()
        data = response.json()
        rate = data.get("rates", {}).get(to_currency)
        return float(rate) if rate else None
    except httpx.HTTPError as exc:  # pragma: no cover - network access
        logger.debug(
            "Frankfurter exchange rate fetch failed for %s -> %s: %s",
            from_currency,
            to_currency,
            exc,
        )
    return None


def _fetch_cross_rate(from_currency: str, to_currency: str) -> Optional[float]:
    base_to_usd = get_exchange_rate(from_currency, "USD")
    usd_to_target = get_exchange_rate("USD", to_currency)
    if base_to_usd and usd_to_target:
        return base_to_usd * usd_to_target
    return None


def _cache_rate(pair_key: str, rate: float) -> None:
    EXCHANGE_RATES[pair_key] = {"rate": rate, "timestamp": time.time()}
