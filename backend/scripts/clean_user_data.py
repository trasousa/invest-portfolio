"""
Clean holdings and securities for a test user to prepare for fresh sync.
"""

import sqlite3
import sys

DB_PATH = "portfolio.db"

def clean_user_data(user_id: int):
    """Remove all holdings, securities, and portfolio history for a user."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Get counts before deletion
        cursor.execute("SELECT COUNT(*) FROM holdings WHERE user_id = ?", (user_id,))
        holdings_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM portfolio_history WHERE user_id = ?", (user_id,))
        history_count = cursor.fetchone()[0]
        
        print(f"User {user_id} before cleanup:")
        print(f"  - Holdings: {holdings_count}")
        print(f"  - Portfolio History: {history_count}")
        
        # Delete user's data
        cursor.execute("DELETE FROM holdings WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM portfolio_history WHERE user_id = ?", (user_id,))
        
        # Clean up orphaned securities (not referenced by any holdings)
        cursor.execute("""
            DELETE FROM securities 
            WHERE id NOT IN (SELECT DISTINCT security_id FROM holdings WHERE security_id IS NOT NULL)
        """)
        
        conn.commit()
        print(f"\n✅ Cleaned successfully!")
        print(f"   - Deleted {holdings_count} holdings")
        print(f"   - Deleted {history_count} portfolio history records")
        print(f"   - Cleaned orphaned securities")
        
    except sqlite3.Error as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    user_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    print(f"Cleaning data for user ID: {user_id}\n")
    clean_user_data(user_id)
    print("\nReady for fresh sync! 🚀")
