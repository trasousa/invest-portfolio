from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.models import User
from app.services.analytics import AnalyticsService
from app.services.dividends import DividendService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/scores")
def get_ai_scores(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = AnalyticsService(db, current_user)
    return service.calculate_ai_scores()

@router.get("/allocation")
def get_allocation_deep_dive(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = AnalyticsService(db, current_user)
    return service.get_allocation_breakdown()

@router.get("/dividends/timeline")
async def get_dividend_timeline(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = DividendService(db, current_user)
    return await service.get_dividend_timeline()
