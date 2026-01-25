from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core import database
from app.models import models
from app.schemas import CashTransaction, CashTransactionCreate
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/cash", tags=["cash"])

@router.get("/transactions", response_model=List[CashTransaction])
def read_transactions(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.CashTransaction).filter(
        models.CashTransaction.owner_id == current_user.id
    ).order_by(models.CashTransaction.date.desc()).all()

@router.post("/transactions", response_model=CashTransaction)
def create_transaction(
    transaction: CashTransactionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_transaction = models.CashTransaction(
        amount=transaction.amount,
        type=transaction.type,
        category=transaction.category,
        description=transaction.description,
        is_recurring=transaction.is_recurring,
        owner_id=current_user.id
    )
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    transaction = db.query(models.CashTransaction).filter(
        models.CashTransaction.id == transaction_id,
        models.CashTransaction.owner_id == current_user.id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction deleted"}

@router.get("/balance")
def get_cash_balance(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    transactions = db.query(models.CashTransaction).filter(
        models.CashTransaction.owner_id == current_user.id
    ).all()
    
    balance = 0.0
    for t in transactions:
        if t.type == "income":
            balance += t.amount
        else:
            balance -= t.amount
            
    return {"balance": balance}
