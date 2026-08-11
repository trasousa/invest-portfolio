import uuid
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    Float,
    DateTime,
    Date,
    Enum as SQLEnum,
    Text,
    JSON,
    Numeric,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import datetime


class AccountType(str, enum.Enum):
    INVESTMENT = "investment"
    CASH = "cash"
    CRYPTO = "crypto"
    PROPERTY = "property"
    VEHICLE = "vehicle"
    OTHER = "other"
    LIABILITY = "liability"


class TransactionType(str, enum.Enum):
    """Types of transactions from brokers or manual entry."""

    BUY = "buy"
    SELL = "sell"
    DIVIDEND = "dividend"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    INTEREST = "interest"
    LENDING_INTEREST = "lending_interest"
    STOCK_SPLIT_OPEN = "stock_split_open"
    STOCK_SPLIT_CLOSE = "stock_split_close"
    STOCK_DISTRIBUTION = "stock_distribution"
    TRANSFER = "transfer"
    FEE = "fee"
    TAX = "tax"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    display_name = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)
    theme_preference = Column(String, default="system")
    openai_api_key = Column(String, nullable=True)
    gemini_api_key = Column(String, nullable=True)
    anthropic_api_key = Column(
        String, nullable=True
    )  # Deprecated, keeping for migration safety or remove
    ollama_url = Column(String, nullable=True, default="http://localhost:11434")
    currency = Column(String, default="EUR")

    # External Connectors
    trading212_api_key = Column(String, nullable=True)  # Encrypted
    trading212_api_secret = Column(String, nullable=True)  # Encrypted
    trading212_is_demo = Column(Boolean, default=False)

    # Trading 212 Sync Tracking
    last_t212_sync_timestamp = Column(DateTime(timezone=True), nullable=True)
    t212_sync_time_from = Column(DateTime(timezone=True), nullable=True)
    t212_sync_time_to = Column(DateTime(timezone=True), nullable=True)

    accounts = relationship(
        "Account", back_populates="owner", cascade="all, delete-orphan"
    )
    holdings = relationship(
        "Holding", back_populates="owner", cascade="all, delete-orphan"
    )
    portfolio_history = relationship(
        "PortfolioHistory", back_populates="owner", cascade="all, delete-orphan"
    )
    dividends = relationship(
        "Dividend", back_populates="owner", cascade="all, delete-orphan"
    )
    interests = relationship(
        "Interest", back_populates="owner", cascade="all, delete-orphan"
    )
    transactions = relationship(
        "Transaction", back_populates="owner", cascade="all, delete-orphan"
    )


class Account(Base):
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # Stored as string for flexibility
    currency = Column(String, default="EUR")
    balance = Column(Float, default=0.0)  # For manual accounts or cached value

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="accounts")

    holdings = relationship(
        "Holding", back_populates="account", cascade="all, delete-orphan"
    )


class Security(Base):
    __tablename__ = "securities"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    symbol = Column(String, unique=True, index=True)
    name = Column(String)
    type = Column(String, default="stock")  # stock, crypto, etf
    current_price = Column(Float)
    sector = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    market = Column(String, nullable=True)  # US, EU, China, etc.
    logo_url = Column(String, nullable=True)  # Company logo URL
    dividend_yield = Column(Float, default=0.0)

    # Property specific
    area_m2 = Column(Float, nullable=True)

    # Bond specific
    maturity_date = Column(Date, nullable=True)
    coupon_rate = Column(
        Float, nullable=True
    )  # Annual interest rate (e.g., 5.0 for 5%)
    face_value = Column(Float, nullable=True)  # Par value

    # Pension specific
    pension_type = Column(String, nullable=True)  # fixed, etf_indexed
    expected_return = Column(Float, nullable=True)  # Annual return % for fixed pensions

    last_updated = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id = Column(String, ForeignKey("accounts.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    security_id = Column(String, ForeignKey("securities.id"))
    quantity = Column(Float, default=0.0)
    avg_cost = Column(Float, default=0.0)
    currency = Column(
        String, default="USD"
    )  # The currency of the asset (e.g. EUR, GBP)

    # Property specific fields
    is_rented = Column(Boolean, default=False)
    rental_income = Column(Float, default=0.0)
    monthly_cost = Column(Float, default=0.0)
    valorization_rate = Column(Float, default=0.0)

    # Pension specific
    monthly_contribution = Column(Float, default=0.0)

    # Recurrent Buy specific
    is_recurrent = Column(Boolean, default=False)
    recurrence_period = Column(String, nullable=True)  # monthly, bi-monthly
    recurrence_amount = Column(Float, default=0.0)

    date_added = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("Account", back_populates="holdings")
    owner = relationship("User", back_populates="holdings")
    security = relationship("Security")


class PortfolioHistory(Base):
    __tablename__ = "portfolio_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, default=datetime.date.today)
    total_value = Column(Float)

    owner = relationship("User", back_populates="portfolio_history")


class Debt(Base):
    __tablename__ = "debts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    principal = Column(Float, default=0.0)
    interest_rate = Column(Float, default=0.0)
    minimum_payment = Column(Float, default=0.0)
    due_date = Column(Integer, nullable=True)  # Day of month

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="debts")

    # Asset Linking
    linked_holding_id = Column(String, ForeignKey("holdings.id"), nullable=True)
    asset_value = Column(Float, nullable=True)  # Manual value if not linked
    appreciation_rate = Column(Float, default=0.0)  # Annual appreciation %
    depreciation_rate = Column(Float, default=0.0)  # Annual depreciation %

    linked_holding = relationship("Holding")


class CashTransaction(Base):
    __tablename__ = "cash_transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False)  # income, expense
    category = Column(String, nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(String, nullable=True)
    is_recurring = Column(Boolean, default=False)

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="cash_transactions")


# Update User relationships
User.debts = relationship("Debt", back_populates="owner", cascade="all, delete-orphan")
User.debts = relationship("Debt", back_populates="owner", cascade="all, delete-orphan")
User.cash_transactions = relationship(
    "CashTransaction", back_populates="owner", cascade="all, delete-orphan"
)
User.chat_history = relationship(
    "ChatHistory", back_populates="owner", cascade="all, delete-orphan"
)


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String, nullable=False)
    response = Column(String, nullable=False)
    provider = Column(String, default="openai")
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="chat_history")


class Dividend(Base):
    """
    Stores dividend payments from any brokerage or manual entry.
    Can be linked to a Transaction for full audit trail.
    """

    __tablename__ = "dividends"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    security_id = Column(String, ForeignKey("securities.id"), nullable=True)
    account_id = Column(String, ForeignKey("accounts.id"), nullable=True)
    transaction_id = Column(
        Integer, ForeignKey("transactions.id"), nullable=True
    )  # Link to Transaction

    amount = Column(Float, nullable=False)
    currency = Column(String, default="EUR")
    payment_date = Column(Date, nullable=False)
    ex_date = Column(Date, nullable=True)

    source = Column(
        String, nullable=False
    )  # "Trading212", "Manual", "InteractiveBrokers", etc.
    ticker = Column(String, nullable=True)  # Original ticker from source
    reference = Column(String, nullable=True)  # External reference ID
    type = Column(String, default="Cash")  # "Cash", "Stock", "DRIP"
    notes = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User")
    security = relationship("Security")
    account = relationship("Account")
    transaction = relationship("Transaction")  # Link to transaction


class Interest(Base):
    """
    Stores interest payments/charges from any source.
    """

    __tablename__ = "interests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    account_id = Column(String, ForeignKey("accounts.id"), nullable=True)

    amount = Column(Float, nullable=False)  # Positive for credit, negative for debit
    currency = Column(String, default="EUR")
    payment_date = Column(Date, nullable=False)

    source = Column(String, nullable=False)  # Brokerage name or "Manual"
    type = Column(String, default="Credit")  # "Credit", "Debit", "Margin"
    reference = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User")
    account = relationship("Account")


class Transaction(Base):
    """
    Broker-agnostic transaction model for all trading activity.
    Stores complete transaction details from Trading 212 CSV and other sources.
    """

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    security_id = Column(String, ForeignKey("securities.id"), nullable=True, index=True)
    account_id = Column(String, ForeignKey("accounts.id"), nullable=True)

    # Unique identifier from broker (for deduplication)
    external_id = Column(String, nullable=True, index=True)

    # Transaction identification
    broker_name = Column(
        String, nullable=False, index=True
    )  # "Trading212", "Manual", "IBKR", etc.
    action_type = Column(SQLEnum(TransactionType), nullable=False, index=True)

    # Timing
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    settlement_date = Column(Date, nullable=True)

    # Security info (nullable for deposits/withdrawals)
    isin = Column(String, nullable=True)
    ticker = Column(String, nullable=True)  # Resolved ticker
    security_name = Column(String, nullable=True)

    # Quantities and pricing
    shares = Column(
        Numeric(precision=18, scale=10), nullable=True
    )  # High precision for fractional shares
    price_per_share = Column(Numeric(precision=18, scale=10), nullable=True)
    price_currency = Column(String, nullable=True)

    # Totals
    total_amount = Column(Numeric(precision=18, scale=2), nullable=False)
    total_currency = Column(String, default="EUR")

    # Conversion and fees
    exchange_rate = Column(Numeric(precision=18, scale=10), nullable=True)
    fees = Column(Numeric(precision=18, scale=2), default=0)
    currency_conversion_fee = Column(Numeric(precision=18, scale=2), default=0)
    withholding_tax = Column(Numeric(precision=18, scale=2), default=0)
    withholding_tax_currency = Column(String, nullable=True)
    french_transaction_tax = Column(
        Numeric(precision=18, scale=2), default=0
    )  # European stocks

    # Result (for sells)
    result_amount = Column(Numeric(precision=18, scale=2), nullable=True)
    result_currency = Column(String, nullable=True)

    # Additional info
    notes = Column(Text, nullable=True)
    raw_data = Column(JSON, nullable=True)  # Store original CSV row or API response

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner = relationship("User", back_populates="transactions")
    security = relationship("Security")
    account = relationship("Account")

    # Indexes for performance
    __table_args__ = (
        Index("idx_user_broker_external", "user_id", "broker_name", "external_id"),
        Index("idx_user_timestamp", "user_id", "timestamp"),
        Index("idx_security_timestamp", "security_id", "timestamp"),
        # Deduplicate on the broker's own identifier. A previous index keyed on
        # (ticker, timestamp, total_amount) could not tell a stock split's close
        # row from its open row - they share all three - so importing any split
        # failed with an IntegrityError.
        Index(
            "uq_user_broker_external_id",
            "user_id",
            "broker_name",
            "external_id",
            unique=True,
        ),
    )


class SecurityHistory(Base):
    """
    Daily snapshots of security holdings for per-stock performance tracking.
    Enables portfolio history visualization per security.
    """

    __tablename__ = "security_history"

    id = Column(Integer, primary_key=True, index=True)
    security_id = Column(
        String, ForeignKey("securities.id"), nullable=False, index=True
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Snapshot date
    date = Column(Date, nullable=False, index=True)

    # Position at end of day
    shares_held = Column(Numeric(precision=18, scale=10), nullable=False)
    avg_cost_basis = Column(
        Numeric(precision=18, scale=2), nullable=False
    )  # Average purchase price
    total_invested = Column(
        Numeric(precision=18, scale=2), nullable=False
    )  # Total amount invested

    # Valuation (from market data)
    market_price = Column(Numeric(precision=18, scale=2), nullable=True)
    market_value = Column(Numeric(precision=18, scale=2), nullable=True)

    # Performance
    unrealized_pnl = Column(Numeric(precision=18, scale=2), nullable=True)
    unrealized_pnl_percent = Column(Float, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    security = relationship("Security")
    owner = relationship("User")

    # Unique constraint: one snapshot per user per security per day
    __table_args__ = (
        Index("idx_user_security_date", "user_id", "security_id", "date", unique=True),
    )
