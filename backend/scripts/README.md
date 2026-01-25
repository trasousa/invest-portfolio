# Backend Scripts

This directory contains utility scripts for database management and testing.

## Database Scripts

### `seed_db.py` - Seed Test Data
Creates a test user with sample portfolio data for development and testing.

**Usage:**
```bash
cd backend
uv run python scripts/seed_db.py
```

**Or run directly in the uv terminal:**
```bash
python scripts/seed_db.py
```


**What it creates:**
- Test user: `test@example.com` / `password123`
- Sample holdings: AAPL, SAP.DE, US10Y bond, property
- Sample debts: Mortgage (linked to property), Car loan

---

### `clean_all.py` - Reset Database
Completely clears all data from the database.

**Usage:**
```bash
cd backend
python -m scripts.clean_all
```

⚠️ **Warning:** This deletes ALL data!

---

### `clean_db.py` - Remove Orphaned Data
Cleans up orphaned securities and other unused data.

**Usage:**
```bash
cd backend
python -m scripts.clean_db
```

---

### `reset_db.py` - Full Database Reset
Drops all tables and recreates them.

**Usage:**
```bash
cd backend
python -m scripts.reset_db
```

⚠️ **Warning:** This destroys the database structure!

---

## Migration Scripts

### `migrate_*.py`
Various migration scripts for schema changes. Generally only used during development.

---

## Quick Start for Testing

**In the backend directory with uv environment:**

1. **Fresh database with test data:**
   ```bash
   # From backend directory
   uv run python scripts/reset_db.py    # Reset database
   uv run python scripts/seed_db.py     # Add test data
   ```

2. **Login with:**
   - Email: `test@example.com`
   - Password: `password123`

3. **Test the app** with pre-populated portfolio!

---

## Running from UV Terminal

If you're already in the `uv` terminal (where backend is running):
```bash
python scripts/seed_db.py
```
