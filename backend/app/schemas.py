from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date

# User Schemas
class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str
    display_name: Optional[str] = None

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    theme_preference: Optional[str] = None
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    ollama_url: Optional[str] = None

class UserThemeUpdate(BaseModel):
    theme_preference: str

class User(UserBase):
    id: int
    
    class Config:
        from_attributes = True

class UserProfile(BaseModel):
    email: str
    display_name: Optional[str] = None
    theme_preference: str = "ocean-dark"
    currency: str = "EUR"
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    ollama_url: Optional[str] = None
    trading212_api_key: Optional[str] = None
    trading212_api_secret: Optional[str] = None
    trading212_is_demo: bool = False
    
    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    theme_preference: Optional[str] = None
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    ollama_url: Optional[str] = None
    currency: Optional[str] = None

class PortfolioSummary(BaseModel):
    total_value: float
    total_assets: float = 0.0
    total_debt: float = 0.0
    annual_income: float
    dividend_yield: float
    yield_on_cost: float

# Security Schemas
class SecurityBase(BaseModel):
    symbol: str
    name: Optional[str] = None
    type: Optional[str] = "stock"
    sector: Optional[str] = None
    industry: Optional[str] = None
    market: Optional[str] = None
    current_price: Optional[float] = None
    dividend_yield: Optional[float] = 0.0
    area_m2: Optional[float] = None
    maturity_date: Optional[date] = None
    coupon_rate: Optional[float] = None
    face_value: Optional[float] = None
    pension_type: Optional[str] = None
    expected_return: Optional[float] = None

class SecurityCreate(SecurityBase):
    pass

class Security(SecurityBase):
    id: str
    last_updated: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Holding Schemas
class HoldingBase(BaseModel):
    quantity: float
    avg_cost: float
    currency: Optional[str] = "USD"
    is_rented: Optional[bool] = False
    rental_income: Optional[float] = 0.0
    monthly_cost: Optional[float] = 0.0
    valorization_rate: Optional[float] = 0.0
    monthly_contribution: Optional[float] = 0.0
    is_recurrent: Optional[bool] = False
    recurrence_period: Optional[str] = None
    recurrence_amount: Optional[float] = 0.0

class HoldingCreate(HoldingBase):
    security_symbol: str
    asset_type: Optional[str] = "stock" # stock, crypto, property, bond
    current_price: Optional[float] = None # For manual assets
    area_m2: Optional[float] = None # For properties
    maturity_date: Optional[date] = None # For bonds
    coupon_rate: Optional[float] = None # For bonds
    face_value: Optional[float] = None # For bonds
    face_value: Optional[float] = None # For bonds
    sector: Optional[str] = None # For properties/manual assets
    pension_type: Optional[str] = None # For pensions
    expected_return: Optional[float] = None # For pensions
    is_recurrent: Optional[bool] = False
    recurrence_period: Optional[str] = None
    recurrence_amount: Optional[float] = 0.0

class Holding(HoldingBase):
    id: str
    account_id: Optional[str] = None
    owner_id: int
    security: Security
    date_added: datetime
    
    class Config:
        from_attributes = True

# Account Schemas
class AccountBase(BaseModel):
    name: str
    type: str
    currency: str = "EUR"
    balance: float = 0.0

class AccountCreate(AccountBase):
    pass

class Account(AccountBase):
    id: str
    owner_id: int
    holdings: List[Holding] = []
    
    class Config:
        from_attributes = True

# Auth Token Schema
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Debt Schemas
class DebtBase(BaseModel):
    name: str
    principal: float
    interest_rate: float = 0.0
    minimum_payment: float = 0.0
    due_date: Optional[int] = None
    linked_holding_id: Optional[str] = None
    asset_value: Optional[float] = None
    appreciation_rate: Optional[float] = 0.0
    depreciation_rate: Optional[float] = 0.0

class DebtCreate(DebtBase):
    pass

class DebtUpdate(BaseModel):
    name: Optional[str] = None
    principal: Optional[float] = None
    interest_rate: Optional[float] = None
    minimum_payment: Optional[float] = None
    due_date: Optional[int] = None
    linked_holding_id: Optional[str] = None
    asset_value: Optional[float] = None
    appreciation_rate: Optional[float] = None
    depreciation_rate: Optional[float] = None

class Debt(DebtBase):
    id: str
    owner_id: int
    
    class Config:
        from_attributes = True

# Cash Schemas
class CashTransactionBase(BaseModel):
    amount: float
    type: str # income, expense
    category: str
    description: Optional[str] = None
    is_recurring: bool = False

class CashTransactionCreate(CashTransactionBase):
    pass

class CashTransaction(CashTransactionBase):
    id: str
    owner_id: int
    date: datetime
    
    class Config:
        from_attributes = True

# Chat History Schemas
class ChatHistoryBase(BaseModel):
    message: str
    response: str
    provider: str = "openai"

class ChatHistoryCreate(ChatHistoryBase):
    pass

class ChatHistory(ChatHistoryBase):
    id: str
    user_id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True
