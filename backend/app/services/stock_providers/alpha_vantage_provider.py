import logging
import os
from typing import Optional

import httpx

from .base_provider import StockProvider, StockData

logger = logging.getLogger(__name__)


class AlphaVantageProvider(StockProvider):
    name = "Alpha Vantage"
    base_url = "https://www.alphavantage.co/query"

    def __init__(self) -> None:
        self.api_key = os.getenv("ALPHA_VANTAGE_API_KEY")

    def is_available(self) -> bool:
        return bool(self.api_key)

    def get_stock_info(self, symbol: str) -> Optional[StockData]:
        if not self.api_key:
            return None

        try:
            with httpx.Client(timeout=10.0) as client:
                overview = self._fetch_overview(client, symbol)
                quote = self._fetch_quote(client, symbol)

            if not overview or not quote:
                return None

            price_raw = quote.get("05. price")
            if price_raw in (None, ""):
                return None
            try:
                price = float(price_raw)
            except (TypeError, ValueError):
                return None

            dividend_yield = 0.0
            yield_raw = overview.get("DividendYield")
            if yield_raw not in (None, ""):
                try:
                    dividend_yield = float(yield_raw)
                except (TypeError, ValueError):
                    dividend_yield = 0.0

            return StockData(
                price=price,
                currency=quote.get("08. previous close currency")
                or overview.get("Currency")
                or "USD",
                name=overview.get("Name", symbol),
                sector=overview.get("Sector", "Unknown"),
                industry=overview.get("Industry", "Unknown"),
                market=overview.get("Country", "Unknown"),
                type="stock",
                dividend_yield=dividend_yield,
                symbol=symbol,
            )
        except Exception as exc:  # pragma: no cover - network access
            logger.warning("AlphaVantageProvider error for %s: %s", symbol, exc)
            return None

    def _fetch_overview(self, client: httpx.Client, symbol: str) -> Optional[dict]:
        response = client.get(
            self.base_url,
            params={
                "function": "OVERVIEW",
                "symbol": symbol,
                "apikey": self.api_key,
            },
        )
        if response.status_code != 200:
            return None
        payload = response.json()
        if not payload or "Error Message" in payload or payload.get("Note"):
            return None
        return payload

    def _fetch_quote(self, client: httpx.Client, symbol: str) -> Optional[dict]:
        response = client.get(
            self.base_url,
            params={
                "function": "GLOBAL_QUOTE",
                "symbol": symbol,
                "apikey": self.api_key,
            },
        )
        if response.status_code != 200:
            return None
        payload = response.json()
        if payload.get("Note"):
            return None
        return payload.get("Global Quote") or None
