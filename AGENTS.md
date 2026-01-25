# FinNexus - Agent Configuration

## Project Overview

FinNexus is a full-stack investment portfolio tracking application built with:
- **Backend**: FastAPI (Python) with SQLAlchemy ORM
- **Frontend**: React with TypeScript and Vite
- **Database**: SQLite (with PostgreSQL support planned)
- **Data Sources**: Yahoo Finance (primary), Alpha Vantage (fallback)
- **Currency API**: Frankfurter.app (ECB rates)

## Architecture

```
FinNexus/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Core configuration
│   │   ├── models/         # SQLAlchemy models
│   │   └── services/       # Business logic services
│   └── scripts/            # Database management scripts
├── frontend/               # React/TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   └── services/       # API client services
├── data/                   # Sample data and exports
└── docker-compose.yml      # Container orchestration
```

## Coding Standards

### Backend (Python/FastAPI)

1. **Type Hinting**: All functions must have proper type hints
2. **Error Handling**: Use structured error handling with custom exceptions
3. **Service Pattern**: Business logic belongs in services, not routes
4. **SQLAlchemy Models**: Use declarative base with proper relationships
5. **Pydantic Models**: Use for request/response validation
6. **Import Organization**:
   ```python
   # Standard library imports
   # Third-party imports
   # Local application imports
   ```

7. **Async Support**: Use async/await for I/O operations (API calls, DB)
8. **Logging**: Use structured logging with appropriate levels
9. **No Print Statements**: Use logger instead of print()

### Frontend (React/TypeScript)

1. **TypeScript**: Use strict mode with explicit types
2. **Component Pattern**: Functional components with hooks
3. **CSS Modules**: Use modular CSS for styling
4. **Service Layer**: Centralized API calls in services/
5. **Error Boundaries**: Wrap components with error boundaries
6. **Environment Variables**: Use VITE_ prefix for frontend env vars

## Database Schema

### Core Models

- **User**: Authentication and user profile
- **Security**: Stock/crypto metadata (symbol, name, sector, etc.)
- **Holding**: User's position in a security (quantity, cost basis)
- **Dividend**: Historical dividend payments
- **Transaction**: Buy/sell transactions (planned feature)

### Key Relationships

- User 1:N Holding
- User 1:N Dividend
- Security 1:N Holding
- Security 1:N Dividend

## API Design

### RESTful Endpoints

- `/api/auth` - Authentication (login, register, refresh)
- `/api/holdings` - Portfolio holdings CRUD
- `/api/dividends` - Dividend timeline and projections
- `/api/prices` - Real-time price updates
- `/api/import` - CSV import functionality
- `/api/export` - Export data (CSV, Google Finance)

### Response Format

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

All error responses include:
- Error code
- Human-readable message
- Optional details object

## Data Providers

### Stock Data Fallback Chain

1. **Yahoo Finance** (primary)
2. **Alpha Vantage** (fallback - requires API key)

### Currency Exchange Rate Fallback Chain

1. **Yahoo Finance** (primary)
2. **Frankfurter.app** (ECB rates - fallback)

### Implementation

- `backend/app/services/stock_providers/` - Provider implementations
- `backend/app/services/price_service.py` - Currency conversion
- Automatic failover on provider errors
- Rate limiting per provider
- Caching to reduce API calls

## Testing Strategy

### Backend

- **Unit Tests**: Test services and utility functions
- **Integration Tests**: Test API endpoints
- ** fixtures**: Use pytest fixtures for test data
- **Coverage**: Aim for >80% coverage on critical paths

### Frontend

- **Component Tests**: Test React components in isolation
- **Integration Tests**: Test user flows
- **Mock API**: Mock backend responses for tests

## Security

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: Use bcrypt
- **Input Validation**: Pydantic models for all inputs
- **CORS**: Configured for frontend origin only
- **No Sensitive Data in Logs**: Sanitize logs
- **Environment Variables**: Store secrets in .env (not committed)

## Performance

- **Caching**: 15-minute price cache, 1-hour exchange rate cache
- **Batch Operations**: Update prices in parallel (ThreadPoolExecutor)
- **Database Indexing**: Indexes on foreign keys and query columns
- **Pagination**: Implement for large datasets
- **Lazy Loading**: Use for large lists in frontend

## DevOps

### Docker Setup

- Multi-stage builds for frontend
- Volume mounts for hot reloading
- Health checks for services
- Restart policies for production

### Local Development

```bash
# Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev

# Or use Docker Compose
docker compose up -d --build
```

### Environment Variables

Backend (.env):
- `SECRET_KEY` - JWT secret
- `ALGORITHM` - JWT algorithm (HS256)
- `DATABASE_URL` - Database connection string
- `ALPHA_VANTAGE_API_KEY` - API key for Alpha Vantage provider

Frontend (.env.local):
- `VITE_API_TARGET` - Backend API URL

## Export Features

### Supported Formats

1. **CSV**: Standard portfolio export
2. **Google Finance**: Import-ready CSV format
   - Headers: `Symbol,Shares,Price,Book Value`
   - Compatible with Google Finance portfolio import

### Implementation

- `backend/app/api/export.py` - Export endpoints
- Currency conversion for multi-currency portfolios
- Validation before export

## AI Agent Integration

### Available Skills

| Name | Description | Model | Use Case |
|------|-------------|-------|----------|
| code-simplifier | Simplifies and refines code for clarity | opus | Refactoring recent changes |
| code-reviewer | Reviews code changes for bugs/issues | N/A | PR reviews |
| bug-fixer | Fixes bugs with minimal changes | N/A | Bug resolution |

### When to Use Agents

- **Code Simplifier**: After completing significant code changes
- **Code Reviewer**: Before committing or creating PRs
- **Bug Fixer**: When fixing reported issues

## Contributing

1. Use the code-simplifier agent after significant changes
2. Follow the established patterns in similar files
3. Test changes locally before submitting
4. Update documentation for new features
5. Follow the coding standards outlined above
