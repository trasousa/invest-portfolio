# FinNexus

FinNexus is a modern, full-stack web application designed to help you track and analyze your investment portfolio. It provides real-time insights into your holdings, diversification, and performance, all wrapped in a sleek, responsive interface.

![Dashboard Screenshot](/Users/tomas.sousa/.gemini/antigravity/brain/960fdb08-cee3-4460-b084-970730b56add/holdings_page_after_login_1763827949882.png)

## Features

- **Portfolio Tracking**: View your total portfolio value, annual income, and performance metrics at a glance.
- **Real-time Data**: Automatically fetches stock prices and company information using Yahoo Finance.
- **Diversification Analysis**: Visualize your portfolio allocation by sector and industry with interactive charts.
- **CSV Import/Export**: Easily import your existing portfolio from CSV files and export your data for backup.
- **Smart Import**: Validates symbols during import and allows you to fix invalid entries on the fly.
- **Theme Support**: Choose from multiple themes (Ocean, Forest, Sunset, Royal) with full dark/light mode support.
- **Secure Authentication**: User registration and login with JWT-based authentication.
- **Responsive Design**: Fully responsive UI that works seamlessly on desktop and mobile devices.

## Tech Stack

### Frontend
- **React**: UI library for building the user interface.
- **Vite**: Next-generation frontend tooling for fast builds.
- **TypeScript**: Typed JavaScript for better code quality and developer experience.
- **Recharts**: Composable charting library for React.
- **Axios**: Promise-based HTTP client for API requests.
- **CSS Modules**: Modular and scoped CSS for styling.

### Backend
- **FastAPI**: Modern, fast (high-performance) web framework for building APIs with Python.
- **SQLAlchemy**: SQL toolkit and Object-Relational Mapping (ORM) for Python.
- **Pydantic**: Data validation and settings management using Python type hints.
- **yfinance**: Yahoo! Finance market data downloader.
- **SQLite**: Lightweight disk-based database (can be easily swapped for PostgreSQL).

### DevOps
- **Docker**: Containerization for consistent development and deployment environments.
- **Docker Compose**: Tool for defining and running multi-container Docker applications.

## Getting Started

### Prerequisites
- Docker and Docker Compose installed on your machine.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd invest-portfolio
    ```

2.  **Start the application:**
    ```bash
    docker compose up -d --build
    ```

3.  **Access the application:**
    - Frontend: `http://localhost:3001`
    - Backend API Docs: `http://localhost:8002/docs`

### Database Management

The project includes scripts to manage the database:

- **Initialize Database**:
  ```bash
  docker compose exec backend python scripts/init_db.py
  ```

- **Seed Mock Data** (Test User & Data):
  ```bash
  docker compose exec backend python scripts/seed_data.py
  ```
  *Creates user: `test@example.com` / `password123`*

- **Reset Database** (Drop all tables):
  ```bash
  docker compose exec backend python scripts/clean_db.py
  ```

## Usage

1.  **Sign Up**: Create a new account on the login page.
2.  **Add Stocks**:
    - Click "Add Stock" to manually search and add individual stocks.
    - Or use "Import" to upload a CSV file with your portfolio data.
3.  **View Insights**: Navigate to the "Diversification" tab to see your portfolio breakdown.
4.  **Customize**: Go to "Settings" to change your theme or update your profile.

## CSV Import Format

The CSV file should have the following headers (case-insensitive):
- `Symbol` (required)
- `Shares` (required)
- `Cost` or `Cost Basis` or `Avg Cost` (required)

Example:
```csv
Symbol,Shares,Cost
AAPL,10,150.00
MSFT,5,280.50
```

## License

This project is licensed under the MIT License.
