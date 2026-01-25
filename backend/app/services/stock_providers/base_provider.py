from abc import ABC, abstractmethod
from typing import Optional
from dataclasses import dataclass

@dataclass
class StockData:
    price: float
    currency: str
    name: str
    sector: str
    industry: str
    market: str
    type: str
    dividend_yield: float
    symbol: str

class StockProvider(ABC):
    """Interface for market-data providers."""

    @abstractmethod
    def get_stock_info(self, symbol: str) -> Optional[StockData]:
        """Return StockData for symbol or None when unavailable."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True when provider can service requests (e.g., API key present)."""
