# Helper function for portfolio.py - add to end of file

def _get_sector_for_ticker(ticker: str) -> str:
    """Get sector for a ticker - simplified mapping"""
    tech_stocks = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'META', 'TSLA', 'AVGO']
    finance_stocks = ['JPM', 'V', 'MA', 'BRK.B', 'BRK-B']
    healthcare_stocks = ['UNH', 'JNJ', 'MRK', 'ABBV', 'NVO']
    consumer_stocks = ['AMZN', 'COST', 'HD', 'PG']
    energy_stocks = ['XOM', 'CVX']
    
    if ticker in tech_stocks:
        return "Technology"
    elif ticker in finance_stocks:
        return "Financial Services"
    elif ticker in healthcare_stocks:
        return "Healthcare"
    elif ticker in consumer_stocks:
        return "Consumer Cyclical"
    elif ticker in energy_stocks:
        return "Energy"
    return "Other"
