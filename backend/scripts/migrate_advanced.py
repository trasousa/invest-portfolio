import sqlite3
import os

# Database path (relative to backend root)
DB_PATH = "portfolio.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        print("Starting migration...")

        # 1. Add 'market' to securities
        try:
            cursor.execute("ALTER TABLE securities ADD COLUMN market VARCHAR")
            print("Added 'market' to securities")
        except sqlite3.OperationalError as e:
            print(f"Skipping 'market': {e}")

        # 2. Add recurrence fields to holdings
        try:
            cursor.execute("ALTER TABLE holdings ADD COLUMN is_recurrent BOOLEAN DEFAULT 0")
            print("Added 'is_recurrent' to holdings")
        except sqlite3.OperationalError as e:
            print(f"Skipping 'is_recurrent': {e}")

        try:
            cursor.execute("ALTER TABLE holdings ADD COLUMN recurrence_period VARCHAR")
            print("Added 'recurrence_period' to holdings")
        except sqlite3.OperationalError as e:
            print(f"Skipping 'recurrence_period': {e}")

        try:
            cursor.execute("ALTER TABLE holdings ADD COLUMN recurrence_amount FLOAT DEFAULT 0.0")
            print("Added 'recurrence_amount' to holdings")
        except sqlite3.OperationalError as e:
            print(f"Skipping 'recurrence_amount': {e}")

        # 3. Update Currency to EUR
        print("Migrating currency to EUR...")
        cursor.execute("UPDATE users SET currency = 'EUR'")
        cursor.execute("UPDATE accounts SET currency = 'EUR'")
        # Update holdings currency only if it was USD (assuming others might be specific)
        cursor.execute("UPDATE holdings SET currency = 'EUR' WHERE currency = 'USD'")
        
        print("Currency migration completed.")

        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
