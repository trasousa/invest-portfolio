"""
Trading 212 CSV Report Parser
Parses exported CSV reports to extract dividends, transactions, and other data.
"""

import csv
from datetime import datetime
from typing import List, Dict, Any
from io import StringIO


def parse_t212_csv(csv_content: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Parse Trading 212 CSV export and categorize rows by action type.
    
    Returns:
        {
            'dividends': [...],
            'deposits': [...],
            'withdrawals': [...],
            'interest': [...],
            'transactions': [...]  # Buy/Sell
        }
    """
    result = {
        'dividends': [],
        'deposits': [],
        'withdrawals': [],
        'interest': [],
        'transactions': []
    }
    
    reader = csv.DictReader(StringIO(csv_content))
    
    for row in reader:
        action = row.get('Action', '').strip()
        
        if not action:
            continue
            
        # Parse dividend
        if 'Dividend' in action:
            result['dividends'].append({
                'action': action,
                'date': parse_date(row.get('Time', '')),
                'isin': row.get('ISIN', ''),
                'ticker': row.get('Ticker', ''),
                'name': row.get('Name', ''),
                'amount': parse_decimal(row.get('Total', '')),
                'currency': row.get('Currency (Total)', 'EUR'),
                'notes': row.get('Notes', ''),
                'type': 'Cash' if 'Cash' in action else 'Stock',
                'source': 'Trading212'
            })
        
        # Parse deposit/withdrawal
        elif action in ['Deposit', 'Withdrawal']:
            target = 'deposits' if action == 'Deposit' else 'withdrawals'
            result[target].append({
                'date': parse_date(row.get('Time', '')),
                'amount': parse_decimal(row.get('Total', '')),
                'currency': row.get('Currency (Total)', 'EUR'),
                'notes': row.get('Notes', '')
            })
        
        # Parse interest
        elif 'Interest' in action:
            amount = parse_decimal(row.get('Total', ''))
            result['interest'].append({
                'date': parse_date(row.get('Time', '')),
                'amount': amount,
                'currency': row.get('Currency (Total)', 'EUR'),
                'type': 'Credit' if amount > 0 else 'Debit',
                'notes': row.get('Notes', ''),
                'source': 'Trading212'
            })
        
        # Parse buy/sell transactions
        elif action in ['Market buy', 'Market sell', 'Limit buy', 'Limit sell', 'Stop buy', 'Stop sell']:
            shares = parse_decimal(row.get('No. of shares', ''))
            price = parse_decimal(row.get('Price / share', ''))
            total = parse_decimal(row.get('Total', ''))
            
            result['transactions'].append({
                'type': 'Buy' if 'buy' in action.lower() else 'Sell',
                'order_type': action.split()[0],  # Market, Limit, Stop
                'date': parse_date(row.get('Time', '')),
                'isin': row.get('ISIN', ''),
                'ticker': row.get('Ticker', ''),
                'name': row.get('Name', ''),
                'quantity': shares,
                'price': price,
                'total': abs(total),
                'currency': row.get('Currency (Total)', 'EUR'),
                'notes': row.get('Notes', ''),
                'source': 'Trading212'
            })
    
    return result


def parse_date(date_str: str) -> datetime:
    """Parse Trading 212 date format."""
    if not date_str:
        return datetime.now()
    
    try:
        # Try ISO format first: 2024-03-26 15:30:00
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        try:
            # Try common formats
            return datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
        except:
            return datetime.now()


def parse_decimal(value_str: str) -> float:
    """Parse decimal values, handling empty strings and formatting."""
    if not value_str or value_str.strip() == '-':
        return 0.0
    
    # Remove currency symbols and whitespace
    cleaned = value_str.replace('€', '').replace('$', '').replace(',', '').strip()
    
    try:
        return float(cleaned)
    except:
        return 0.0


if __name__ == "__main__":
    # Test with sample data
    sample = """Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Total,Currency (Total),Notes
Dividend (Cash),2024-03-26 10:00:00,US0378331005,AAPL_US_EQ,Apple Inc.,-,-,EUR,1.0,3.19,EUR,
Market buy,2024-01-15 14:30:00,US0378331005,AAPL_US_EQ,Apple Inc.,10,150.00,USD,0.92,-1380.00,EUR,
Interest on cash,2024-02-01 00:00:00,-,-,-,-,-,EUR,1.0,0.45,EUR,"""
    
    result = parse_t212_csv(sample)
    
    print("Parsed CSV:")
    print(f"Dividends: {len(result['dividends'])}")
    print(f"Transactions: {len(result['transactions'])}")
    print(f"Interest: {len(result['interest'])}")
    
    if result['dividends']:
        print(f"\nFirst dividend: {result['dividends'][0]}")
