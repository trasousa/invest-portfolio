import os
from app.core.database import engine, Base
from app.models import models

def reset_db():
    print("Resetting database...")
    try:
        # Drop all tables
        Base.metadata.drop_all(bind=engine)
        print("All tables dropped.")
        
        # Recreate all tables
        Base.metadata.create_all(bind=engine)
        print("All tables recreated.")
        
    except Exception as e:
        print(f"Error resetting database: {e}")

if __name__ == "__main__":
    # Confirm before running
    confirm = input("This will DELETE ALL DATA. Are you sure? (y/n): ")
    if confirm.lower() == 'y':
        reset_db()
    else:
        print("Operation cancelled.")
