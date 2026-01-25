"""
Completely clean test user data and orphaned securities.
"""

import sqlite3

DB_PATH = "portfolio.db"

def clean_all():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        user_id = 1
        
        # Count before
        cursor.execute("SELECT COUNT(*) FROM holdings WHERE owner_id = ?", (user_id,))
        holdings = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM securities")
        securities = cursor.fetchone()[0]
        
        print(f"Before: {holdings} holdings, {securities} securities")
        
        # Delete all user data
        cursor.execute("DELETE FROM holdings WHERE owner_id = ?", (user_id,))
        cursor.execute("DELETE FROM debts WHERE owner_id = ?", (user_id,))
        cursor.execute("DELETE FROM portfolio_history WHERE user_id = ?", (user_id,))
        
        # Delete ALL securities (they'll be recreated by seed_db.py)
        cursor.execute("DELETE FROM securities")
        
        conn.commit()
        
        # Count after
        cursor.execute("SELECT COUNT(*) FROM holdings WHERE owner_id = ?", (user_id,))
        holdings = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM securities")
        securities = cursor.fetchone()[0]
        
        print(f"After:  {holdings} holdings, {securities} securities")
        print("\n✅ Database cleaned! Run seed_db.py to add fresh mock data.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    clean_all()
