# FinNexus Backend

FastAPI backend for the FinNexus application.

## Overview

This backend provides a RESTful API for managing investment portfolios, including user authentication, stock tracking, and portfolio analytics.

## Technology Stack

- **Framework**: FastAPI
- **ORM**: SQLAlchemy
- **Database**: SQLite
- **Authentication**: JWT with bcrypt
- **Package Manager**: uv
- **Stock Data**: yfinance

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/theme` - Update theme preference

### Stocks
- `GET /api/stocks` - List all stocks
- `POST /api/stocks` - Add new stock
- `PUT /api/stocks/{id}` - Update stock
- `DELETE /api/stocks/{id}` - Delete stock
- `POST /api/stocks/import` - Import stocks from CSV
- `GET /api/stocks/export` - Export stocks to CSV

### Portfolio
- `GET /api/portfolio/summary` - Portfolio summary metrics
- `POST /api/portfolio/refresh` - Refresh stock prices
- `GET /api/portfolio/diversification` - Sector/industry breakdown

### Search
- `GET /api/search?q={query}` - Search for stocks

## Testing the Backend

### Using Docker (Recommended)

The backend is running in Docker. To test:

1. **Check if backend is running**:
   ```bash
   curl http://localhost:8000/
   ```
   Should return: `{"message":"Portfolio Tracker API is running"}`

2. **View API documentation**:
   Open http://localhost:8000/docs in your browser for interactive Swagger UI

3. **Test authentication flow**:
   ```bash
   # Signup
   curl -X POST http://localhost:8000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123"}'
   
   # Login
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123"}'
   
   # Save the access_token from response
   ```

4. **Test authenticated endpoints**:
   ```bash
   # Replace YOUR_TOKEN with the token from login
   export TOKEN="YOUR_TOKEN"
   
   # Get stocks
   curl http://localhost:8000/api/stocks \
     -H "Authorization: Bearer $TOKEN"
   
   # Add a stock
   curl -X POST http://localhost:8000/api/stocks \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "symbol":"AAPL",
       "name":"Apple Inc.",
       "shares":10,
       "cost_basis":150.00,
       "current_price":0
     }'
   
   # Get portfolio summary
   curl http://localhost:8000/api/portfolio/summary \
     -H "Authorization: Bearer $TOKEN"
   ```

5. **Search for stocks**:
   ```bash
   curl "http://localhost:8000/api/search?q=apple"
   ```

### Using Python Locally

If you want to run the backend locally without Docker:

1. **Install uv** (if not already installed):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Install dependencies**:
   ```bash
   cd backend
   uv sync
   ```

3. **Run the server**:
   ```bash
   uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

4. **Run tests** (when implemented):
   ```bash
   uv run pytest
   ```

### Running Unit Tests

Unit tests are located in the `tests/` directory.

```bash
# Inside the backend container
docker compose exec backend uv run pytest

# Or locally
cd backend
uv run pytest
```

### Viewing Logs

```bash
# View backend logs
docker compose logs backend

# Follow logs in real-time
docker compose logs -f backend
```

## Database

The application uses SQLite with the database file stored at `/app/portfolio.db` inside the Docker container.

### Schema

**Users Table**:
- id, email, hashed_password
- display_name, bio, profile_image_url
- theme_preference

**Stocks Table**:
- id, symbol, name, shares, cost_basis, current_price
- sector, industry, date_added
- owner_id (foreign key to users)

### Resetting the Database

```bash
# Stop containers
docker compose down

# Remove the database file
rm backend/portfolio.db

# Restart
docker compose up -d
```

## Environment Variables

Default configuration works out of the box. For production:

- `SECRET_KEY`: JWT secret (default: "your-secret-key-here-please-change-in-production")
- `ALGORITHM`: JWT algorithm (default: "HS256")
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Token expiration (default: 30)

## Troubleshooting

### Backend won't start

1. Check logs: `docker compose logs backend`
2. Verify port 8000 is not in use
3. Try rebuilding: `docker compose build backend`

### Database errors

1. Delete `backend/portfolio.db`
2. Restart containers

### Import errors

Make sure your CSV has the correct format:
```csv
symbol,name,shares,cost_basis
AAPL,Apple Inc.,10,150.00
```

## API Response Formats

### Success Response
```json
{
  "id": 1,
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "shares": 10.0,
  "cost_basis": 150.00,
  "current_price": 178.50,
  "market_value": 1785.00,
  "gain_loss": 285.00,
  "gain_loss_percent": 19.00,
  "sector": "Technology",
  "industry": "Consumer Electronics",
  "date_added": "2025-11-22T14:00:00Z"
}
```

### Error Response
```json
{
  "detail": "Error message here"
}
```

## Development

### Adding New Endpoints

1. Create route in `app/routers/`
2. Define Pydantic schemas in `app/schemas.py`
3. Add database models in `app/models/models.py` if needed
4. Test with curl or Swagger UI

### Code Style

- Follow PEP 8
- Use type hints
- Document functions with docstrings
- Keep routes RESTful
