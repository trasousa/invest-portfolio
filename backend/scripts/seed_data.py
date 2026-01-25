import sys
import os
from datetime import date, timedelta

# Add the parent directory to sys.path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import engine, SessionLocal
from app import models
from app.core.security import get_password_hash

def seed_data():
    db = SessionLocal()
    try:
        # Check if user exists
        user = db.query(models.User).filter(models.User.email == "test@example.com").first()
        if not user:
            print("Creating test user...")
            user = models.User(
                email="test@example.com",
                hashed_password=get_password_hash("password123"),
                display_name="Test User",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Create User Profile
            profile = models.UserProfile(
                user_id=user.id,
                currency="USD",
                theme_preference="ocean-dark"
            )
            db.add(profile)
            db.commit()
        else:
            print("Test user already exists.")

        # Create Holdings
        if db.query(models.Holding).filter(models.Holding.user_id == user.id).count() == 0:
            print("Seeding holdings...")
            
            # Stock: AAPL
            aapl = models.Security(
                symbol="AAPL",
                name="Apple Inc.",
                type="stock",
                current_price=150.00,
                sector="Technology"
            )
            db.add(aapl)
            db.commit()
            
            holding1 = models.Holding(
                user_id=user.id,
                security_id=aapl.id,
                quantity=10,
                avg_cost=140.00
            )
            db.add(holding1)

            # Crypto: BTC
            btc = models.Security(
                symbol="BTC-USD",
                name="Bitcoin",
                type="crypto",
                current_price=45000.00,
                sector="Cryptocurrency"
            )
            db.add(btc)
            db.commit()

            holding2 = models.Holding(
                user_id=user.id,
                security_id=btc.id,
                quantity=0.5,
                avg_cost=40000.00
            )
            db.add(holding2)
            
            # Property
            prop = models.Security(
                symbol="PROP-001",
                name="Downtown Apartment",
                type="property",
                current_price=500000.00,
                sector="Residential",
                area_m2=85.0
            )
            db.add(prop)
            db.commit()
            
            holding3 = models.Holding(
                user_id=user.id,
                security_id=prop.id,
                quantity=1,
                avg_cost=480000.00
            )
            db.add(holding3)

            db.commit()
            print("Holdings seeded.")

        # Create Cash Transactions
        if db.query(models.CashTransaction).filter(models.CashTransaction.user_id == user.id).count() == 0:
            print("Seeding cash transactions...")
            
            t1 = models.CashTransaction(
                user_id=user.id,
                amount=5000.00,
                type="income",
                category="Salary",
                date=date.today() - timedelta(days=30),
                is_recurring=True
            )
            db.add(t1)

            t2 = models.CashTransaction(
                user_id=user.id,
                amount=1500.00,
                type="expense",
                category="Rent",
                date=date.today() - timedelta(days=28),
                is_recurring=True
            )
            db.add(t2)
            
            t3 = models.CashTransaction(
                user_id=user.id,
                amount=200.00,
                type="expense",
                category="Groceries",
                date=date.today() - timedelta(days=5),
                is_recurring=False
            )
            db.add(t3)

            db.commit()
            print("Cash transactions seeded.")

        print("Database seeded successfully!")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
