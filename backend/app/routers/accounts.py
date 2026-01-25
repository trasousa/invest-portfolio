from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import uuid
import csv
import io
from app.core import database
from app.models import models
from app.schemas import Account, AccountCreate, Holding, HoldingCreate
from app.routers.auth import get_current_user
from app.services.price_service import get_stock_info

router = APIRouter(prefix="/api/accounts", tags=["accounts"])

@router.get("", response_model=List[Account])
def read_accounts(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Account).filter(models.Account.owner_id == current_user.id).all()

@router.post("", response_model=Account)
def create_account(
    account: AccountCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_account = models.Account(
        name=account.name,
        type=account.type,
        currency=account.currency,
        balance=account.balance,
        owner_id=current_user.id
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

@router.post("/{account_id}/holdings", response_model=Holding)
def add_holding(
    account_id: str,
    holding: HoldingCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    print(f"Adding holding to account {account_id}: {holding}")
    try:
        account = db.query(models.Account).filter(
            models.Account.id == account_id,
            models.Account.owner_id == current_user.id
        ).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        # Find or create Security
        symbol = holding.security_symbol.upper()
        security = db.query(models.Security).filter(models.Security.symbol == symbol).first()
        
        if not security:
            # Check account type to decide whether to fetch info or use provided/default
            is_investment = account.type.lower() in ['investment', 'brokerage', 'retirement']
            
            if is_investment:
                # Fetch data
                info = get_stock_info(symbol)
                if not info:
                     raise HTTPException(status_code=400, detail="Invalid symbol")
                
                security = models.Security(
                    symbol=symbol,
                    name=info['name'],
                    current_price=info['price'],
                    sector=info.get('sector'),
                    industry=info.get('industry'),
                    type=info.get('type', 'stock')
                )
            else:
                # Manual creation for Crypto/Property
                # Use provided current_price or avg_cost
                price = holding.current_price if holding.current_price is not None else holding.avg_cost
                
                sec_type = "stock"
                if 'crypto' in account.type.lower():
                    sec_type = "crypto"
                elif any(x in account.type.lower() for x in ['property', 'real estate']):
                    sec_type = "property"
                
                security = models.Security(
                    symbol=symbol,
                    name=symbol, # Use symbol as name
                    current_price=price,
                    sector=account.type.capitalize(),
                    industry=account.type.capitalize(),
                    type=sec_type
                )

            db.add(security)
            db.commit()
            db.refresh(security)

        # Create Holding
        db_holding = models.Holding(
            account_id=account.id,
            security_id=security.id,
            quantity=holding.quantity,
            avg_cost=holding.avg_cost
        )
        db.add(db_holding)
        db.commit()
        db.refresh(db_holding)
        return db_holding
    except Exception as e:
        print(f"Error adding holding: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{account_id}/holdings/{holding_id}")
def delete_holding(
    account_id: str,
    holding_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify account ownership
    account = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.owner_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    holding = db.query(models.Holding).filter(
        models.Holding.id == holding_id,
        models.Holding.account_id == account_id
    ).first()
    
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    db.delete(holding)
    db.commit()
    return {"message": "Holding deleted"}

@router.put("/{account_id}/holdings/{holding_id}", response_model=Holding)
def update_holding(
    account_id: str,
    holding_id: str,
    holding_update: HoldingCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    account = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.owner_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    db_holding = db.query(models.Holding).filter(
        models.Holding.id == holding_id,
        models.Holding.account_id == account_id
    ).first()
    
    if not db_holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    db_holding.quantity = holding_update.quantity
    db_holding.avg_cost = holding_update.avg_cost
    
    db.commit()
    db.refresh(db_holding)
    return db_holding

@router.post("/{account_id}/import")
async def import_holdings(
    account_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    account = db.query(models.Account).filter(
        models.Account.id == account_id,
        models.Account.owner_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    content = await file.read()
    decoded_content = content.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(decoded_content))
    
    imported_count = 0
    for row in csv_reader:
        # Flexible column names
        symbol = row.get('symbol') or row.get('Symbol') or row.get('Ticker')
        quantity = row.get('quantity') or row.get('Quantity') or row.get('shares') or row.get('Shares')
        avg_cost = row.get('avg_cost') or row.get('cost_basis') or row.get('Cost Basis') or row.get('price') or row.get('Price') or 0.0
        
        if not symbol or not quantity:
            continue
            
        symbol = symbol.upper()
        try:
            quantity = float(quantity)
            avg_cost = float(avg_cost)
        except ValueError:
            continue
            
        # Find or create Security
        security = db.query(models.Security).filter(models.Security.symbol == symbol).first()
        if not security:
            info = get_stock_info(symbol)
            if not info:
                continue
            
            security_data = {
                'symbol': symbol,
                'name': info['name'],
                'current_price': info['price'],
                'sector': info.get('sector'),
                'industry': info.get('industry')
            }

            # Override type/sector for Crypto/Property accounts if fetched from API
            if account.type.lower() == 'crypto':
                security_data['type'] = 'crypto'
                security_data['sector'] = 'Cryptocurrency'
                security_data['industry'] = 'Digital Assets'
            elif account.type.lower() in ['property', 'real estate']:
                security_data['type'] = 'property'
                security_data['sector'] = 'Real Estate'
                security_data['industry'] = 'Property'

            security = models.Security(**security_data)
            
            db.add(security)
            db.commit()
            db.refresh(security)
            
        # Check if holding exists
        holding = db.query(models.Holding).filter(
            models.Holding.account_id == account.id,
            models.Holding.security_id == security.id
        ).first()
        
        if holding:
            # Update existing holding (weighted average)
            total_cost = (holding.quantity * holding.avg_cost) + (quantity * avg_cost)
            holding.quantity += quantity
            holding.avg_cost = total_cost / holding.quantity if holding.quantity > 0 else 0
        else:
            holding = models.Holding(
                account_id=account.id,
                security_id=security.id,
                quantity=quantity,
                avg_cost=avg_cost
            )
            db.add(holding)
        
        imported_count += 1
    
    db.commit()
    return {"message": f"Imported {imported_count} holdings"}
