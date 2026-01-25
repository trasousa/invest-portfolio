import csv
import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import List
from app.core import database
from app.models import models
from app.schemas import Holding, HoldingCreate
from app.routers.auth import get_current_user
from app.services.price_service import get_stock_info, get_exchange_rate

router = APIRouter(prefix="/api/holdings", tags=["holdings"])

@router.get("/", response_model=List[Holding])
def get_holdings(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    return current_user.holdings

@router.post("/", response_model=Holding)
def create_holding(
    holding: HoldingCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Check if security exists
    security = db.query(models.Security).filter(models.Security.symbol == holding.security_symbol).first()
    info = None
    
    if not security:
        # Fetch info and create security
        # Only fetch info if it's a stock or crypto (and not explicitly marked as manual/property)
        if holding.asset_type in ["stock", "crypto"]:
             info = get_stock_info(holding.security_symbol)
        
        if not info:
            # Fallback for manual assets (Property/Crypto manual/Bond)
            security = models.Security(
                symbol=holding.security_symbol,
                name=holding.security_symbol,
                current_price=holding.current_price or holding.avg_cost, # Ensure price is set
                type=holding.asset_type or "unknown",
                sector=holding.sector or ("Real Estate" if holding.asset_type == "property" else ("Fixed Income" if holding.asset_type == "bond" else None)),
                area_m2=holding.area_m2,
                maturity_date=holding.maturity_date,
                coupon_rate=holding.coupon_rate,
                face_value=holding.face_value,
                pension_type=holding.pension_type,
                expected_return=holding.expected_return
            )
        else:
            security = models.Security(
                symbol=holding.security_symbol,
                name=info['name'],
                current_price=info['price'],
                sector=info.get('sector'),
                industry=info.get('industry'),
                market=info.get('market'),
                type=info.get('type', 'stock'),
                dividend_yield=info.get('dividend_yield', 0)
            )
        db.add(security)
        db.commit()
        db.refresh(security)
    
    # Determine currency
    # If provided in request, use it.
    # If not, and we have stock info, try to use that.
    # Default to USD.
    holding_currency = holding.currency
    if not holding_currency and info:
        holding_currency = info.get('currency', 'USD')
    if not holding_currency:
        holding_currency = "USD"

    # Check if holding already exists for this user and security
    existing_holding = db.query(models.Holding).filter(
        models.Holding.owner_id == current_user.id,
        models.Holding.security_id == security.id
    ).first()

    if existing_holding:
        # Merge holdings
        total_quantity = existing_holding.quantity + holding.quantity
        if total_quantity > 0:
            # Weighted average cost
            total_cost = (existing_holding.quantity * existing_holding.avg_cost) + (holding.quantity * holding.avg_cost)
            existing_holding.avg_cost = total_cost / total_quantity
        else:
            # Should not happen for additions, but safe fallback
            existing_holding.avg_cost = holding.avg_cost
            
        existing_holding.quantity = total_quantity
        
        # Update other fields if provided (optional, usually we keep existing unless explicitly overwriting)
        # For properties, we might want to update rental info
        if holding.asset_type == 'property':
            existing_holding.is_rented = holding.is_rented
            existing_holding.rental_income = holding.rental_income
            existing_holding.monthly_cost = holding.monthly_cost
            existing_holding.valorization_rate = holding.valorization_rate
        
        if holding.asset_type == 'pension':
            existing_holding.monthly_contribution = holding.monthly_contribution
            
        db.commit()
        db.refresh(existing_holding)
        return existing_holding
    else:
        # Create new holding
        db_holding = models.Holding(
            owner_id=current_user.id,
            security_id=security.id,
            quantity=holding.quantity,
            avg_cost=holding.avg_cost,
            is_rented=holding.is_rented,
            rental_income=holding.rental_income,
            monthly_cost=holding.monthly_cost,
            valorization_rate=holding.valorization_rate,
            monthly_contribution=holding.monthly_contribution,
            is_recurrent=holding.is_recurrent,
            recurrence_period=holding.recurrence_period,
            recurrence_amount=holding.recurrence_amount
        )
        db.add(db_holding)
        db.commit()
        db.refresh(db_holding)
        return db_holding

@router.put("/{holding_id}", response_model=Holding)
def update_holding(
    holding_id: str,
    holding_update: HoldingCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    holding = db.query(models.Holding).filter(
        models.Holding.id == holding_id,
        models.Holding.owner_id == current_user.id
    ).first()
    
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
        
    holding.quantity = holding_update.quantity
    holding.avg_cost = holding_update.avg_cost
    
    # Update security sector if provided (mainly for properties)
    if holding_update.sector:
        holding.security.sector = holding_update.sector
        
    if holding_update.pension_type:
        holding.security.pension_type = holding_update.pension_type
        
    if holding_update.expected_return is not None:
        holding.security.expected_return = holding_update.expected_return
        
    holding.monthly_contribution = holding_update.monthly_contribution
    holding.is_recurrent = holding_update.is_recurrent
    holding.recurrence_period = holding_update.recurrence_period
    holding.recurrence_amount = holding_update.recurrence_amount
    
    db.commit()
    db.refresh(holding)
    return holding

@router.delete("/{holding_id}")
def delete_holding(
    holding_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    holding = db.query(models.Holding).filter(
        models.Holding.id == holding_id,
        models.Holding.owner_id == current_user.id
    ).first()
    
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
        
    # Unlink any debts associated with this holding
    try:
        print(f"Attempting to delete holding {holding_id} for user {current_user.id}")
        debts = db.query(models.Debt).filter(models.Debt.linked_holding_id == holding_id).all()
        if debts:
            print(f"Found {len(debts)} linked debts. Unlinking...")
            for debt in debts:
                debt.linked_holding_id = None
                debt.asset_value = 0 # Or keep last known value? Set to 0 for safety.
            db.commit()
            print("Debts unlinked successfully.")
            
        # Refresh holding to ensure it's attached to session
        holding = db.query(models.Holding).filter(
            models.Holding.id == holding_id,
            models.Holding.owner_id == current_user.id
        ).first()
        
        if holding:
            print(f"Deleting holding {holding_id}...")
            db.delete(holding)
            db.commit()
            print("Holding deleted successfully.")
        else:
            print("Holding not found after debt unlink.")
            
        return {"message": "Holding deleted"}
    except Exception as e:
        print(f"Error deleting holding: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete holding: {str(e)}")


@router.get("/export/google-finance")
def export_google_finance(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    holdings = (
        db.query(models.Holding)
        .filter(models.Holding.owner_id == current_user.id)
        .all()
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Symbol", "Shares", "Price", "Book Value"])

    target_currency = (current_user.currency or "USD").upper()

    for holding in holdings:
        security = holding.security
        symbol = security.symbol if security else holding.security_id
        if not symbol:
            continue

        asset_currency = (holding.currency or "USD").upper()
        price = (security.current_price if security else None) or holding.avg_cost or 0.0

        rate = get_exchange_rate(asset_currency, target_currency)
        converted_price = price * rate if price else 0.0
        book_value = holding.quantity * (holding.avg_cost or 0.0)
        converted_book_value = book_value * rate if book_value else 0.0

        writer.writerow(
            [
                symbol,
                f"{holding.quantity:.6f}",
                f"{converted_price:.2f}",
                f"{converted_book_value:.2f}",
            ]
        )

    csv_bytes = buffer.getvalue()
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=google-finance-export.csv",
            "X-Export-Currency": target_currency,
        },
    )
