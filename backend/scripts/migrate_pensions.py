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
        # Add columns to securities table
        print("Migrating securities table...")
        try:
            cursor.execute("ALTER TABLE securities ADD COLUMN pension_type VARCHAR")
            print("Added pension_type to securities")
        except sqlite3.OperationalError as e:
            print(f"Skipping pension_type: {e}")

        try:
            cursor.execute("ALTER TABLE securities ADD COLUMN expected_return FLOAT")
            print("Added expected_return to securities")
        except sqlite3.OperationalError as e:
            print(f"Skipping expected_return: {e}")

        # Add columns to holdings table
        print("Migrating holdings table...")
        try:
            cursor.execute("ALTER TABLE holdings ADD COLUMN monthly_contribution FLOAT DEFAULT 0.0")
            print("Added monthly_contribution to holdings")
        except sqlite3.OperationalError as e:
            print(f"Skipping monthly_contribution: {e}")

        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
