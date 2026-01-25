export interface Security {
  id: string;
  symbol: string;
  name: string;
  type: string;
  current_price: number;
  sector?: string;
  industry?: string;
  dividend_yield?: number;
  area_m2?: number;
  pension_type?: string;
  expected_return?: number;
  market?: string;
}

export interface Holding {
  id: string;
  account_id: string;
  quantity: number;
  avg_cost: number;
  security: Security;
  date_added: string;
  is_rented?: boolean;
  rental_income?: number;
  monthly_cost?: number;
  valorization_rate?: number;
  currency: string;
  maturity_date?: string;
  coupon_rate?: number;
  face_value?: number;
  monthly_contribution?: number;
  is_recurrent?: boolean;
  recurrence_period?: string;
  recurrence_amount?: number;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  holdings: Holding[];
}

export interface PortfolioSummary {
  total_value: number;
  total_assets: number;
  total_debt: number;
  annual_income: number;
  dividend_yield: number;
  yield_on_cost: number;
}

export interface UserProfile {
  id: number;
  email: string;
  display_name?: string;
  bio?: string;
  profile_image_url?: string;
  theme_preference: string;
  currency: string;
  openai_api_key?: string;
  gemini_api_key?: string;
  ollama_url?: string;
  trading212_api_key?: string;
  trading212_api_secret?: string;
  trading212_is_demo?: boolean;
}

export interface HoldingCreate {
  security_symbol: string;
  quantity: number;
  avg_cost: number;
  current_price?: number;
  asset_type?: string;
  currency?: string;
  area_m2?: number;
  is_rented?: boolean;
  rental_income?: number;
  monthly_cost?: number;
  valorization_rate?: number;
  maturity_date?: string;
  coupon_rate?: number;
  face_value?: number;
  sector?: string;
  pension_type?: string;
  expected_return?: number;
  monthly_contribution?: number;
  is_recurrent?: boolean;
  recurrence_period?: string;
  recurrence_amount?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UserSettings {
  openai_api_key?: string;
  gemini_api_key?: string;
  ollama_url?: string;
}
