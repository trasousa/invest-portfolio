from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core import database
from app.models import models
from app.routers import auth, accounts, portfolio, chat, debts, cash, holdings, connectors, analytics, market
from fastapi import Query
import requests

# Create tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="FinNexus API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(portfolio.router)
app.include_router(holdings.router)
app.include_router(chat.router)
app.include_router(debts.router)
app.include_router(cash.router)
app.include_router(connectors.router, prefix="/api/connectors", tags=["connectors"])
app.include_router(analytics.router)
app.include_router(market.router)

@app.get("/")
def read_root():
    return {"message": "Portfolio Tracker API is running"}

@app.get("/api/")
def read_api_root():
    return {"message": "Portfolio Tracker API is running"}

@app.get("/api/search")
def search_stocks(q: str = Query(..., min_length=1)):
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={q}&lang=en-US&region=US&quotesCount=5&newsCount=0"
        headers = {'User-Agent': 'Mozilla/5.0'}
        r = requests.get(url, headers=headers)
        data = r.json()
        
        results = []
        if 'quotes' in data:
            for quote in data['quotes']:
                results.append({
                    "symbol": quote.get('symbol'),
                    "name": quote.get('shortname') or quote.get('longname'),
                    "type": quote.get('quoteType'),
                    "exchange": quote.get('exchange')
                })
        return results
    except Exception as e:
        print(f"Search error: {e}")
        return []
