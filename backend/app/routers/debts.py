from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core import database
from app.models import models
from app.schemas import Debt, DebtCreate
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/debts", tags=["debts"])

@router.get("", response_model=List[Debt])
def read_debts(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Debt).filter(models.Debt.owner_id == current_user.id).all()

@router.post("", response_model=Debt)
def create_debt(
    debt: DebtCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_debt = models.Debt(
        name=debt.name,
        principal=debt.principal,
        interest_rate=debt.interest_rate,
        minimum_payment=debt.minimum_payment,
        due_date=debt.due_date,
        owner_id=current_user.id,
        linked_holding_id=debt.linked_holding_id,
        asset_value=debt.asset_value,
        appreciation_rate=debt.appreciation_rate,
        depreciation_rate=debt.depreciation_rate
    )
    db.add(db_debt)
    db.commit()
    db.refresh(db_debt)
    return db_debt

@router.put("/{debt_id}", response_model=Debt)
def update_debt(
    debt_id: str,
    debt_update: DebtCreate, # Using DebtCreate as it has all fields, or create specific Update schema if partial
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    debt = db.query(models.Debt).filter(
        models.Debt.id == debt_id,
        models.Debt.owner_id == current_user.id
    ).first()
    
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
        
    debt.name = debt_update.name
    debt.principal = debt_update.principal
    debt.interest_rate = debt_update.interest_rate
    debt.minimum_payment = debt_update.minimum_payment
    debt.due_date = debt_update.due_date
    debt.linked_holding_id = debt_update.linked_holding_id
    debt.asset_value = debt_update.asset_value
    debt.appreciation_rate = debt_update.appreciation_rate
    debt.depreciation_rate = debt_update.depreciation_rate
    
    db.commit()
    db.refresh(debt)
    return debt

@router.delete("/{debt_id}")
def delete_debt(
    debt_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    debt = db.query(models.Debt).filter(
        models.Debt.id == debt_id,
        models.Debt.owner_id == current_user.id
    ).first()
    
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    db.delete(debt)
    db.commit()
    return {"message": "Debt deleted"}

@router.post("/{debt_id}/repayment")
def record_repayment(
    debt_id: str,
    amount: float,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    debt = db.query(models.Debt).filter(
        models.Debt.id == debt_id,
        models.Debt.owner_id == current_user.id
    ).first()
    
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    # Reduce principal
    debt.principal = max(0, debt.principal - amount)
    db.commit()
    db.refresh(debt)
    return debt
