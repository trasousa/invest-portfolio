import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from collections import defaultdict

# Add backend to path (parent of scripts/)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SQLALCHEMY_DATABASE_URL
from app.models.models import Transaction, Dividend, PortfolioHistory, Base

def deduplicate_data():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    print("🚀 Starting Data Deduplication...")

    # 1. Deduplicate Transactions (by external_id)
    print("\n🔍 Checking for duplicate Transactions...")
    transactions = db.query(Transaction).all()
    tx_map = defaultdict(list)
    for tx in transactions:
        if tx.external_id:
            tx_map[tx.external_id].append(tx)
    
    deleted_tx = 0
    for ext_id, tx_list in tx_map.items():
        if len(tx_list) > 1:
            # Keep the one with the highest ID (newest?) or lowest? 
            # Usually keep the first one found or the one with most info.
            # We'll keep the one with the lowest ID (oldest record).
            tx_list.sort(key=lambda x: x.id)
            to_keep = tx_list[0]
            for duplicate in tx_list[1:]:
                print(f"   🗑️ Deleting duplicate transaction {duplicate.id} (ext_id: {ext_id})")
                db.delete(duplicate)
                deleted_tx += 1
    
    print(f"✓ Removed {deleted_tx} duplicate transactions.")

    # 2. Deduplicate Dividends (by user, security, date, amount)
    print("\n🔍 Checking for duplicate Dividends...")
    dividends = db.query(Dividend).all()
    div_map = defaultdict(list)
    for div in dividends:
        # Key: user_id-security_id-date-amount
        key = f"{div.user_id}-{div.security_id}-{div.payment_date}-{div.amount}"
        div_map[key].append(div)
        
    deleted_div = 0
    for key, div_list in div_map.items():
        if len(div_list) > 1:
            div_list.sort(key=lambda x: x.id)
            for duplicate in div_list[1:]:
                print(f"   🗑️ Deleting duplicate dividend {duplicate.id} (key: {key})")
                db.delete(duplicate)
                deleted_div += 1
                
    print(f"✓ Removed {deleted_div} duplicate dividends.")

    # 3. Deduplicate Portfolio History (by user, date)
    print("\n🔍 Checking for duplicate Portfolio History...")
    history = db.query(PortfolioHistory).all()
    hist_map = defaultdict(list)
    for h in history:
        key = f"{h.user_id}-{h.date}"
        hist_map[key].append(h)
        
    deleted_hist = 0
    for key, h_list in hist_map.items():
        if len(h_list) > 1:
            h_list.sort(key=lambda x: x.id, reverse=True) # Keep newest calculation
            for duplicate in h_list[1:]:
                print(f"   🗑️ Deleting duplicate history {duplicate.id} (key: {key})")
                db.delete(duplicate)
                deleted_hist += 1

    print(f"✓ Removed {deleted_hist} duplicate history records.")

    if deleted_tx + deleted_div + deleted_hist > 0:
        print("\n💾 Committing changes...")
        db.commit()
        print("✅ Done!")
    else:
        print("\n✨ No duplicates found.")
    
    db.close()

    # 4. Add Unique Constraints (Raw SQL for SQLite/Postgres compatibility)
    print("\n🔒 Adding Unique Constraints...")
    # SQLite doesn't support ALTER TABLE ADD CONSTRAINT easily for multi-column.
    # We will try creating unique indexes instead.
    
    with engine.connect() as conn:
        try:
            # Transaction External ID
            print("   → Index: idx_transactions_external_id")
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions(external_id) WHERE external_id IS NOT NULL"))
            
            # Portfolio History
            print("   → Index: idx_portfolio_history_user_date")
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_history_user_date ON portfolio_history(user_id, date)"))
            
            # Dividends (Soft constraint, might be valid to have multiple same day? rare)
            # We'll rely on the dedupe logic for now or add a simpler index
            # conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_dividends_dedupe ON dividends(user_id, security_id, payment_date, amount)"))
            
            print("✅ Constraints (Unique Indexes) added.")
        except Exception as e:
            print(f"⚠️ Error adding constraints: {e}")

if __name__ == "__main__":
    deduplicate_data()
