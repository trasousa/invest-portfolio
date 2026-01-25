from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any
from app.core import database
from app.models import models
from app.routers.auth import get_current_user
from app.chatbot.agent import FinnAgent

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, Any]] = []
    provider: str = "openai" # Default to openai

@router.post("/")
async def chat(
    request: ChatRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Get user settings for API keys
    user_settings = {
        "openai_api_key": current_user.openai_api_key,
        "gemini_api_key": current_user.gemini_api_key,
        "openai_api_key": current_user.openai_api_key,
        "gemini_api_key": current_user.gemini_api_key,
        "ollama_url": current_user.ollama_url
    }
    
    try:
        agent = FinnAgent(db, current_user.id, user_settings, provider=request.provider)
        response = await agent.chat(request.message, request.history)
        
        # Save to history
        chat_entry = models.ChatHistory(
            user_id=current_user.id,
            message=request.message,
            response=response,
            provider=request.provider
        )
        db.add(chat_entry)
        db.commit()
        
        return {"response": response}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Chat Error: {e}")
        # Return the actual error message for debugging
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/history")
def get_chat_history(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    history = db.query(models.ChatHistory).filter(
        models.ChatHistory.user_id == current_user.id
    ).order_by(models.ChatHistory.timestamp.asc()).all()
    return history
