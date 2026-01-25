from sqlalchemy.orm import Session
from app.models.models import User, Holding, Security
from typing import Dict, List, Any
import math

class AnalyticsService:
    def __init__(self, db: Session, user: User):
        self.db = db
        self.user = user

    def get_portfolio_summary(self) -> Dict[str, Any]:
        # Calculate total value, etc.
        # This logic might overlap with existing portfolio service, but we can enhance it.
        pass

    def calculate_ai_scores(self) -> Dict[str, int]:
        """
        Calculate 0-10 scores for Diversification, Risk, Fees, Macro.
        """
        holdings = self.db.query(Holding).filter(Holding.owner_id == self.user.id).all()
        
        if not holdings:
            return {"diversification": 0, "risk": 0, "fees": 0, "macro": 0}

        # 1. Diversification
        # Logic: Number of distinct sectors. >5 sectors = 10/10, <2 = 2/10
        sectors = set()
        assets = 0
        for h in holdings:
            assets += 1
            if h.security and h.security.sector:
                sectors.add(h.security.sector)
        
        div_score = min(10, len(sectors) * 2)
        if assets > 0 and div_score == 0: div_score = 2 # Minimum score if you have assets but no sector info
        
        # 2. Risk
        # Logic: Allocation to "risky" assets (Crypto, Tech) vs "safe" (Bonds, Utilities, Consumer Defensive)
        # For now, simplistic: 10 - (Crypto % * 10)
        risky_value = 0
        total_value = 0
        for h in holdings:
            val = h.quantity * ((h.security.current_price if h.security and h.security.current_price else 0.0))
            total_value += val
            if h.security and h.security.sector in ["Technology", "Crypto", "Consumer Cyclical"]:
                risky_value += val
        
        risk_ratio = (risky_value / total_value) if total_value > 0 else 0
        # If 100% risky, score 3. If 0% risky, score 8. Balanced (50%) -> 10.
        # Let's say optimal risk is 40-60%.
        if 0.4 <= risk_ratio <= 0.6:
            risk_score = 10
        else:
            dist = abs(risk_ratio - 0.5)
            risk_score = max(1, int(10 - (dist * 15)))
        
        # 3. Fees
        # Logic: Placeholder for now as we don't have expense ratios. 
        # Assume ETFs have fees, stocks don't.
        etf_count = sum(1 for h in holdings if h.security and h.security.type == 'ETF')
        fees_score = 8 if etf_count > 0 else 9 # Stocks are usually free trading now
        
        # 4. Macro
        # Logic: Randomize slightly around a base "Market Sentiment" score
        # In real app, fetch VIX or similar.
        import random
        macro_score = 5 + random.randint(-1, 2)
        
        return {
            "diversification": div_score,
            "risk": risk_score,
            "fees": fees_score,
            "macro": macro_score
        }

    def get_allocation_breakdown(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Return breakdown by Sector, Region, etc.
        """
        holdings = self.db.query(Holding).filter(Holding.owner_id == self.user.id).all()
        
        sector_map = {}
        total_value = 0
        
        for h in holdings:
            value = h.quantity * (h.security.current_price if h.security else 0)
            total_value += value
            sector = h.security.sector if h.security and h.security.sector else "Other"
            sector_map[sector] = sector_map.get(sector, 0) + value
            
        sectors = []
        for name, val in sector_map.items():
            sectors.append({
                "name": name,
                "value": val,
                "percentage": (val / total_value * 100) if total_value > 0 else 0
            })
            
        # Sort by value desc
        sectors.sort(key=lambda x: x["value"], reverse=True)
        
        return {
            "Sectors": sectors,
            "Regions": [] # Implement similar logic if region data exists
        }
