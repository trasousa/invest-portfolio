import logging
from typing import Optional

import yfinance as yf

from .base_provider import StockProvider, StockData

logger = logging.getLogger(__name__)


class YFinanceProvider(StockProvider):
    name = "Yahoo Finance"

    def is_available(self) -> bool:
        return True

    def get_stock_info(self, symbol: str) -> Optional[StockData]:
        sanitized = (symbol or "").strip().upper()
        if not sanitized:
            return None

        suffixes_to_try = ["", ".L", ".DE", ".AS", ".PA", ".MC", ".SW", ".MI"]
        candidates = self._build_candidates(sanitized, suffixes_to_try)

        for idx, ticker_symbol in enumerate(candidates):
            try:
                ticker = yf.Ticker(ticker_symbol)
                info = ticker.info

                price = info.get("currentPrice") or info.get("regularMarketPrice")
                if not price:
                    price = self._get_fast_price(ticker)

                if not price:
                    continue

                is_crypto = (
                    "-USD" in ticker_symbol.upper()
                    or info.get("quoteType") == "CRYPTOCURRENCY"
                )

                return StockData(
                    price=float(price),
                    currency=info.get("currency", "USD"),
                    name=info.get("longName") or info.get("shortName") or ticker_symbol,
                    sector=info.get("sector")
                    or ("Cryptocurrency" if is_crypto else "Unknown"),
                    industry=info.get("industry")
                    or ("Digital Assets" if is_crypto else "Unknown"),
                    market=info.get("country")
                    or ("Global" if is_crypto else "Unknown"),
                    type="crypto" if is_crypto else "stock",
                    dividend_yield=(info.get("dividendYield", 0) or 0) / 100.0,
                    symbol=ticker_symbol,
                )
            except Exception as exc:
                if idx == len(candidates) - 1:
                    logger.warning(
                        "YFinanceProvider error for %s: %s", ticker_symbol, exc
                    )
        return None

    def _build_candidates(self, symbol: str, suffixes: list[str]) -> list[str]:
        has_suffix = any(sep in symbol for sep in [".", "-", ":"])
        candidates: list[str] = []

        if has_suffix:
            candidates.append(symbol)
            if "." in symbol:
                base = symbol.split(".")[0]
                if base and base != symbol:
                    candidates.append(base)
            return candidates

        for suffix in suffixes:
            ticker_symbol = f"{symbol}{suffix}" if suffix else symbol
            if ticker_symbol not in candidates:
                candidates.append(ticker_symbol)
        return candidates

    def _get_fast_price(self, ticker: yf.Ticker) -> Optional[float]:
        try:
            fast_info = ticker.fast_info
            return float(getattr(fast_info, "last_price", None) or 0) or None
        except Exception:
            return None
