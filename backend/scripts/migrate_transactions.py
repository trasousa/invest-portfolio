"""
Migration script to add dividends, interests, and transactions tables.
Run this to update your database with the new transaction tracking tables.
"""

import sqlite3
import os

DB_PATH = "portfolio.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database {DB_PATH} not found!")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Create dividends table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS dividends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            security_id TEXT,
            account_id TEXT,
            amount REAL NOT NULL,
            currency TEXT DEFAULT 'EUR',
            payment_date DATE NOT NULL,
            ex_date DATE,
            source TEXT NOT NULL,
            ticker TEXT,
            reference TEXT,
            type TEXT DEFAULT 'Cash',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (security_id) REFERENCES securities(id),
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
        """)
        print("✓ Created dividends table")
        
        # Create interests table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS interests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            account_id TEXT,
            amount REAL NOT NULL,
            currency TEXT DEFAULT 'EUR',
            payment_date DATE NOT NULL,
            source TEXT NOT NULL,
            type TEXT DEFAULT 'Credit',
            reference TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
        """)
        print("✓ Created interests table")
        
        # Create transactions table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            security_id TEXT,
            account_id TEXT,
            type TEXT NOT NULL,
            quantity REAL NOT NULL,
            price REAL,
            total_amount REAL NOT NULL,
            fees REAL DEFAULT 0.0,
            currency TEXT DEFAULT 'EUR',
            transaction_date TIMESTAMP NOT NULL,
            settlement_date DATE,
            source TEXT NOT NULL,
            ticker TEXT,
            reference TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (security_id) REFERENCES securities(id),
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
        """)
        print("✓ Created transactions table")
        
        # Create indexes for better query performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_dividends_user ON dividends(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_dividends_payment_date ON dividends(payment_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_interests_user ON interests(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)")
        print("✓ Created indexes")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        print("Your database now has dividends, interests, and transactions tables.")
        
    except sqlite3.Error as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("Running database migration...")
    print(f"Database: {DB_PATH}\n")
    migrate()
