import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import csv
import datetime
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models import models
from app.core.security import get_password_hash
from app.services.price_service import get_stock_info

def seed_db():
    db = SessionLocal()
    try:
        print("Seeding database...")
        
        # 1. Create Test User (or get existing)
        email = "test@example.com"
        password = "password123"
        
        existing_user = db.query(models.User).filter(models.User.email == email).first()
        if existing_user:
            print(f"User {email} already exists. Clearing old data...")
            user = existing_user
            
            # Clear existing test user data for fresh start
            db.query(models.Holding).filter(models.Holding.owner_id == user.id).delete()
            db.query(models.Debt).filter(models.Debt.owner_id == user.id).delete()
            db.query(models.PortfolioHistory).filter(models.PortfolioHistory.user_id == user.id).delete()
            
            # Clean up orphaned securities
            from sqlalchemy import text
            db.execute(text("""
                DELETE FROM securities 
                WHERE id NOT IN (SELECT DISTINCT security_id FROM holdings WHERE security_id IS NOT NULL)
            """))
            db.commit()
            print("✅ Cleared old data")
        else:
            hashed_password = get_password_hash(password)
            user = models.User(
                email=email, 
                hashed_password=hashed_password,
                display_name="Test User",
                bio="Crypto & Tech Investor"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created user: {email}")

        # 2. Create Securities manually for testing
        # AAPL (USD)
        aapl = db.query(models.Security).filter(models.Security.symbol == "AAPL").first()
        if not aapl:
            aapl = models.Security(
                symbol="AAPL",
                name="Apple Inc.",
                type="stock",
                current_price=150.0,
                sector="Technology",
                industry="Consumer Electronics",
                dividend_yield=0.005
            )
            db.add(aapl)
        
        # SAP (EUR)
        sap = db.query(models.Security).filter(models.Security.symbol == "SAP.DE").first()
        if not sap:
            sap = models.Security(
                symbol="SAP.DE",
                name="SAP SE",
                type="stock",
                current_price=160.0, # EUR
                sector="Technology",
                industry="Software - Infrastructure",
                dividend_yield=0.015
            )
            db.add(sap)

        # Bond (USD)
        bond = db.query(models.Security).filter(models.Security.symbol == "US10Y").first()
        if not bond:
            bond = models.Security(
                symbol="US10Y",
                name="US Treasury 10Y",
                type="bond",
                current_price=98.5,
                sector="Fixed Income",
                industry="Government",
                maturity_date=datetime.date(2033, 5, 15),
                coupon_rate=3.5,
                face_value=100.0
            )
            db.add(bond)

        # Property (Manual)
        prop_sec = db.query(models.Security).filter(models.Security.symbol == "PROP-001").first()
        if not prop_sec:
            prop_sec = models.Security(
                symbol="PROP-001",
                name="Downtown Apartment",
                type="property",
                current_price=350000.0,
                sector="Real Estate",
                industry="Residential",
                area_m2=85.0
            )
            db.add(prop_sec)
        
        db.commit()

        # 3. Create Holdings (Fresh after clearing)
        # AAPL in USD
        h1 = models.Holding(
            owner_id=user.id,
            security_id=aapl.id,
            quantity=10,
            avg_cost=140.0,
            currency="USD"
        )
        
        # SAP in EUR
        h2 = models.Holding(
            owner_id=user.id,
            security_id=sap.id,
            quantity=5,
            avg_cost=150.0,
            currency="EUR"
        )
        
        # Bond in USD
        h3 = models.Holding(
            owner_id=user.id,
            security_id=bond.id,
            quantity=100, # 100 bonds
            avg_cost=99.0,
            currency="USD"
        )
        
        db.add(h1)
        db.add(h2)
        db.add(h3)
        db.commit()
        print("Added holdings: AAPL, SAP.DE, US10Y")

        # 3.1 Property Holding
        prop_holding = models.Holding(
            owner_id=user.id,
            security_id=prop_sec.id,
            quantity=1,
            avg_cost=300000.0,
            currency="USD",
            is_rented=True,
            rental_income=1500.0,
            monthly_cost=200.0,
            valorization_rate=3.0
        )
        db.add(prop_holding)
        db.commit()
        db.refresh(prop_holding)
        print("Added Property holding")
        
        # 4. Create Debts
        d1 = models.Debt(
            name="Mortgage",
            principal=250000.0,
            interest_rate=3.5,
            minimum_payment=1200.0,
            due_date=1,
            owner_id=user.id,
            linked_holding_id=prop_holding.id, # Link to property
            appreciation_rate=3.0
        )
        
        d2 = models.Debt(
            name="Car Loan",
            principal=15000.0,
            interest_rate=5.0,
            minimum_payment=350.0,
            due_date=15,
            owner_id=user.id,
            asset_value=20000.0, # Manual asset value
            appreciation_rate=-10.0 # Depreciation
        )
        
        db.add(d1)
        db.add(d2)
        db.commit()
        print("Added debts: Mortgage (Linked), Car Loan")

        
        print("Seeding complete!")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
