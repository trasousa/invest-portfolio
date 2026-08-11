"""
Trading 212 CSV Parser

Parses Trading 212 historical export CSV files and converts them into
standardized Transaction objects for database import.

Handles all transaction types:
- Market buy/sell
- Dividends
- Deposits/Withdrawals
- Interest (cash, lending)
- Stock splits
- Stock distributions 
- Fees and taxes
"""

import csv
import hashlib
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
from io import StringIO
import logging

logger = logging.getLogger(__name__)


class T212CSVParser:
    """Parser for Trading 212 CSV export files."""

    # Map Trading 212 'Action' values to our TransactionType enum.
    # Trading 212 emits one row per order type, so limit/stop orders have to be
    # mapped alongside market orders - otherwise those trades are dropped and
    # every holding they touch ends up with the wrong share count.
    ACTION_TYPE_MAP = {
        "Market buy": "buy",
        "Limit buy": "buy",
        "Stop buy": "buy",
        "Stop limit buy": "buy",
        "Market sell": "sell",
        "Limit sell": "sell",
        "Stop sell": "sell",
        "Stop limit sell": "sell",
        "Deposit": "deposit",
        "Withdrawal": "withdrawal",
        "Interest on cash": "interest",
        "Lending interest": "lending_interest",
        "Stock split open": "stock_split_open",
        "Stock split close": "stock_split_close",
        "Stock distribution": "stock_distribution",
    }

    # Timestamp formats seen across Trading 212 exports.
    TIME_FORMATS = ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d")

    @staticmethod
    def _map_action(action: str) -> Optional[str]:
        """
        Resolve a CSV 'Action' value to a TransactionType value.

        Dividends arrive as a family of labels - "Dividend (Dividend)",
        "Dividend (Dividend manufactured payment)", "Dividend (Bonus)" and so on -
        so they are matched by prefix rather than enumerated one by one.
        """
        mapped = T212CSVParser.ACTION_TYPE_MAP.get(action)
        if mapped:
            return mapped
        if action.startswith("Dividend"):
            return "dividend"
        return None

    @staticmethod
    def parse_csv(csv_content: str) -> List[Dict[str, Any]]:
        """
        Parse Trading 212 CSV content into list of transaction dictionaries.
        
        Args:
            csv_content: Raw CSV content as string
            
        Returns:
            List of transaction dictionaries ready for database import
        """
        transactions = []
        
        csv_file = StringIO(csv_content)
        reader = csv.DictReader(csv_file)
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 (1 is header)
            try:
                tx = T212CSVParser._parse_row(row)
                if tx:
                    transactions.append(tx)
            except Exception as e:
                logger.error(f"Error parsing row {row_num}: {e}")
                logger.error(f"Row data: {row}")
                # Continue parsing other rows
        
        logger.info(f"Parsed {len(transactions)} transactions from CSV")
        return transactions
    
    @staticmethod
    def _parse_row(row: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Parse a single CSV row into a transaction dictionary."""
        
        action = row.get("Action", "").strip()
        
        # Skip empty rows
        if not action:
            return None
        
        # Map action to transaction type
        action_type = T212CSVParser._map_action(action)
        if not action_type:
            logger.warning(f"Unknown action type: {action}")
            return None

        # Parse timestamp
        time_str = row.get("Time", "").strip()
        timestamp = T212CSVParser._parse_timestamp(time_str)

        # Extract common fields
        transaction = {
            # Identification
            "external_id": T212CSVParser._external_id(row),
            "broker_name": "Trading212",
            "action_type": action_type,
            "timestamp": timestamp,
            
            # Security info
            "isin": row.get("ISIN", "").strip() or None,
            "ticker": row.get("Ticker", "").strip() or None,
            "security_name": row.get("Name", "").strip() or None,
            
            # Quantities and pricing
            "shares": T212CSVParser._parse_decimal(row.get("No. of shares")),
            "price_per_share": T212CSVParser._parse_decimal(row.get("Price / share")),
            "price_currency": row.get("Currency (Price / share)", "").strip() or None,
            
            # Totals
            "total_amount": T212CSVParser._parse_decimal(row.get("Total")) or Decimal("0"),
            "total_currency": row.get("Currency (Total)", "EUR").strip(),
            
            # Conversion and fees ('fees' is the total of every charge on the row)
            "exchange_rate": T212CSVParser._parse_decimal(row.get("Exchange rate")),
            "fees": T212CSVParser._total_fees(row),
            "currency_conversion_fee": T212CSVParser._parse_decimal(row.get("Currency conversion fee")) or Decimal("0"),
            "withholding_tax": T212CSVParser._parse_decimal(row.get("Withholding tax")) or Decimal("0"),
            "withholding_tax_currency": row.get("Currency (Withholding tax)", "").strip() or None,
            "french_transaction_tax": T212CSVParser._parse_decimal(row.get("French transaction tax")) or Decimal("0"),
            
            # Result (for sells)
            "result_amount": T212CSVParser._parse_decimal(row.get("Result")),
            "result_currency": row.get("Currency (Result)", "").strip() or None,
            
            # Additional info
            "notes": row.get("Notes", "").strip() or None,
            "raw_data": dict(row),  # Store entire row for debugging
        }
        
        return transaction
    
    @staticmethod
    def _parse_timestamp(time_str: str) -> Optional[datetime]:
        """Parse a CSV 'Time' value, tolerating optional fractional seconds."""
        if not time_str:
            return None
        for fmt in T212CSVParser.TIME_FORMATS:
            try:
                return datetime.strptime(time_str, fmt)
            except ValueError:
                continue
        raise ValueError(f"Unrecognised timestamp format: {time_str!r}")

    @staticmethod
    def _external_id(row: Dict[str, str]) -> str:
        """
        Return a stable per-transaction identifier.

        Trading 212 leaves the ID column empty on dividend rows. A null id makes
        the importer's `external_id == None` lookup match *every* previously
        imported id-less row, so all but the first dividend would be discarded as
        duplicates. Derive a deterministic fingerprint from the row's content
        instead: it is stable across re-exports, so re-syncing the same period
        still deduplicates correctly.
        """
        provided = (row.get("ID") or "").strip()
        if provided:
            return provided

        fingerprint = "|".join(
            (row.get(field) or "").strip()
            for field in (
                "Action",
                "Time",
                "ISIN",
                "Ticker",
                "No. of shares",
                "Price / share",
                "Total",
                "Currency (Total)",
            )
        )
        digest = hashlib.sha1(fingerprint.encode("utf-8")).hexdigest()[:24]
        return f"t212-{digest}"

    @staticmethod
    def _total_fees(row: Dict[str, str]) -> Decimal:
        """Sum every fee/tax column present on the row."""
        total = Decimal("0")
        for field in (
            "Currency conversion fee",
            "Stamp duty reserve tax",
            "French transaction tax",
            "Transaction fee",
            "Finra fee",
        ):
            total += T212CSVParser._parse_decimal(row.get(field)) or Decimal("0")
        return total

    @staticmethod
    def _parse_decimal(value: Optional[str]) -> Optional[Decimal]:
        """Parse a string value to Decimal, handling empty/invalid values."""
        if not value or value.strip() == "":
            return None
        
        try:
            # Remove any currency symbols, commas, etc.
            cleaned = value.strip().replace(",", "")
            return Decimal(cleaned)
        except (ValueError, ArithmeticError) as e:
            logger.warning(f"Could not parse decimal '{value}': {e}")
            return None


# Standalone function for easy import
def parse_t212_csv(csv_content: str) -> List[Dict[str, Any]]:
    """
    Parse Trading 212 CSV content.
    
    Args:
        csv_content: Raw CSV string
        
    Returns:
        List of transaction dictionaries
    """
    return T212CSVParser.parse_csv(csv_content)


if __name__ == "__main__":
    # Test with sample CSV
    sample_csv = """Action,Time,ISIN,Ticker,Name,Notes,ID,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Currency (Result),Total,Currency (Total),Withholding tax,Currency (Withholding tax),Currency conversion fee,Currency (Currency conversion fee),French transaction tax,Currency (French transaction tax)
Market buy,2025-11-10 08:00:42,IE00B3XXRP09,VUSA,"Vanguard S&P 500 (Dist)",,EOF41600695522,1.5726242200,97.6900000000,GBP,0.87918999,,EUR,175.00,EUR,,,0.26,EUR,,
Dividend (Dividend),2025-11-13 10:46:17,US0378331005,AAPL,"Apple",,,2.5000000000,0.221000,USD,0.86877828,,,0.48,EUR,0.10,USD,,,,
Deposit,2025-11-14 06:56:40,,,,,0599ac14-8743-46cf-b493-61aedc1b6432,,,,,,,300.00,EUR,,,,,,
"""
    
    transactions = parse_t212_csv(sample_csv)
    
    print(f"Parsed {len(transactions)} transactions:\n")
    for tx in transactions:
        print(f"{tx['action_type']}: {tx['security_name'] or 'N/A'} - {tx['total_amount']} {tx['total_currency']}")
