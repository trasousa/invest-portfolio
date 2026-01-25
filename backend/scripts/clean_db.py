import sys
import os

# Add the parent directory to sys.path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, Base
from app import models

def clean_db():
    print("Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    print("All tables dropped successfully!")

if __name__ == "__main__":
    confirm = input("Are you sure you want to delete all data? (y/n): ")
    if confirm.lower() == 'y':
        clean_db()
    else:
        print("Operation cancelled.")
