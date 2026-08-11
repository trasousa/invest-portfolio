"""
Replace the transactions uniqueness index.

The old index keyed on (user_id, broker_name, ticker, timestamp, total_amount).
A stock split is exported as two rows - a close for the pre-split quantity and an
open for the post-split quantity - that share the ticker, the timestamp and the
total, so importing any split failed with:

    UNIQUE constraint failed: transactions.user_id, transactions.broker_name,
    transactions.ticker, transactions.timestamp, transactions.total_amount

Those rows do carry distinct broker ids, so uniqueness now keys on
(user_id, broker_name, external_id) instead.

Run with:  uv run python scripts/migrate_transaction_dedupe_index.py
"""

import os
import sqlite3

DB_PATH = os.path.join("data", "portfolio.db")

OLD_INDEX = "uq_user_symbol_time_amount"
NEW_INDEX = "uq_user_broker_external_id"


def migrate() -> None:
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'"
        )
        if not cursor.fetchone():
            print("No transactions table yet; nothing to migrate")
            return

        columns = {row[1] for row in cursor.execute("PRAGMA table_info(transactions)")}
        if "external_id" not in columns:
            print(
                "transactions table predates external_id - run the transaction "
                "migration first, then re-run this script"
            )
            return

        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name=?", (OLD_INDEX,)
        )
        if cursor.fetchone():
            cursor.execute(f"DROP INDEX {OLD_INDEX}")
            print(f"Dropped {OLD_INDEX}")
        else:
            print(f"{OLD_INDEX} not present, nothing to drop")

        # Rows imported before external_id was always populated may share a NULL
        # id. SQLite treats each NULL as distinct in a unique index, so they do
        # not block the new index, but report them so they can be re-synced.
        cursor.execute(
            "SELECT COUNT(*) FROM transactions WHERE external_id IS NULL OR external_id = ''"
        )
        (null_ids,) = cursor.fetchone()
        if null_ids:
            print(
                f"Note: {null_ids} transaction(s) have no external_id "
                "(imported before the parser generated one)"
            )

        cursor.execute(
            "SELECT user_id, broker_name, external_id, COUNT(*) c FROM transactions "
            "WHERE external_id IS NOT NULL AND external_id != '' "
            "GROUP BY user_id, broker_name, external_id HAVING c > 1"
        )
        duplicates = cursor.fetchall()
        if duplicates:
            print(f"Found {len(duplicates)} duplicated external ids; removing extras...")
            for user_id, broker_name, external_id, _ in duplicates:
                cursor.execute(
                    "DELETE FROM transactions WHERE id NOT IN ("
                    "  SELECT MIN(id) FROM transactions"
                    "  WHERE user_id=? AND broker_name=? AND external_id=?"
                    ") AND user_id=? AND broker_name=? AND external_id=?",
                    (user_id, broker_name, external_id) * 2,
                )

        cursor.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS {NEW_INDEX} "
            "ON transactions (user_id, broker_name, external_id)"
        )
        print(f"Created {NEW_INDEX}")

        conn.commit()
        print("Migration complete.")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
