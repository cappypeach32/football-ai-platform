from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.models import User

router = APIRouter()


@router.get("/plans")
async def get_plans():
    return {
        "plans": [
            {"id": "free", "name": "Free", "price": 0, "features": ["5 predictions/day", "Basic stats"]},
            {"id": "premium", "name": "Premium", "price": 9.99, "features": ["Unlimited predictions", "AI insights", "Backtesting", "Live analytics"]},
            {"id": "vip", "name": "VIP", "price": 24.99, "features": ["Everything in Premium", "API access", "Priority support", "Custom alerts"]},
        ]
    }


@router.get("/my")
async def my_subscription(current_user: User = Depends(get_current_user)):
    if current_user.subscription:
        return {
            "plan": current_user.subscription.plan.value,
            "status": current_user.subscription.status.value,
            "current_period_end": current_user.subscription.current_period_end,
        }
    return {"plan": "free", "status": "active"}
