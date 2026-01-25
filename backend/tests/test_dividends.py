import yfinance as yf

symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']
for symbol in symbols:
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        div_yield = info.get('dividendYield')
        print(f"{symbol}: {div_yield} (Type: {type(div_yield)})")
    except Exception as e:
        print(f"{symbol}: Error {e}")
