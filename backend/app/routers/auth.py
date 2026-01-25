from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from app.core import database, security
from app.models import models
from app.schemas import UserCreate, Token, TokenData, User, UserProfile, UserProfileUpdate, UserThemeUpdate
from pydantic import BaseModel
from app import schemas

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/signup", response_model=User)
def create_user(user: UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password, display_name=user.display_name)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/profile", response_model=schemas.UserProfile)
def get_user_profile(current_user: models.User = Depends(get_current_user)):
    # Return profile but don't expose encrypted keys
    profile = schemas.UserProfile.from_orm(current_user)
    # Replace encrypted values with placeholders of matching length
    if current_user.trading212_api_key:
        profile.trading212_api_key = "•" * len(current_user.trading212_api_key)
    if current_user.trading212_api_secret:
        profile.trading212_api_secret = "•" * len(current_user.trading212_api_secret)
    if current_user.openai_api_key:
        profile.openai_api_key = "•" * len(current_user.openai_api_key)
    if current_user.gemini_api_key:
        profile.gemini_api_key = "•" * len(current_user.gemini_api_key)
    return profile


@router.put("/profile", response_model=schemas.UserProfile)
def update_user_profile(
    profile_update: schemas.UserProfileUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    print(f"Updating profile for {current_user.email} with data: {profile_update}")
    try:
        if profile_update.display_name is not None:
            current_user.display_name = profile_update.display_name
        if profile_update.bio is not None:
            current_user.bio = profile_update.bio
        if profile_update.profile_image_url is not None:
            current_user.profile_image_url = profile_update.profile_image_url
        if profile_update.openai_api_key:
            current_user.openai_api_key = profile_update.openai_api_key
        if profile_update.gemini_api_key:
            current_user.gemini_api_key = profile_update.gemini_api_key
        if profile_update.currency is not None:
            current_user.currency = profile_update.currency
        
        db.commit()
        db.refresh(current_user)
        return current_user
    except Exception as e:
        print(f"Error updating profile: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/theme", response_model=schemas.UserProfile)
def update_user_theme(
    theme_update: schemas.UserThemeUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    current_user.theme_preference = theme_update.theme_preference
    db.commit()
    db.refresh(current_user)
    return current_user

@router.delete("/account")
def delete_user_account(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Delete all stocks associated with user first
    db.query(models.Stock).filter(models.Stock.owner_id == current_user.id).delete()
    
    # Delete user account
    db.delete(current_user)
    db.commit()
    
    return {"message": "Account deleted successfully"}

class TestKeyRequest(BaseModel):
    provider: str
    api_key: str

@router.post("/test-key")
def test_api_key(request: TestKeyRequest):
    try:
        if request.provider == "openai":
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(api_key=request.api_key, model="gpt-3.5-turbo")
            llm.invoke("Hello")
        elif request.provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            # Try a list of likely available models, prioritizing user request
            models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"]
            last_error = None
            success = False
            
            for model in models_to_try:
                try:
                    llm = ChatGoogleGenerativeAI(google_api_key=request.api_key, model=model)
                    llm.invoke("Hello")
                    success = True
                    break
                except Exception as e:
                    last_error = e
                    continue
            
            if not success:
                # Try to list available models to help debug
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=request.api_key)
                    available_models = [m.name for m in genai.list_models()]
                    print(f"Available Gemini Models for this key: {available_models}")
                    raise HTTPException(status_code=400, detail=f"API Key Test Failed. No working model found. Available: {available_models}")
                except Exception as list_error:
                    print(f"Could not list models: {list_error}")
                    raise HTTPException(status_code=400, detail=f"API Key Test Failed: {str(last_error)}")
                
        elif request.provider == "anthropic":
            from langchain_anthropic import ChatAnthropic
            llm = ChatAnthropic(api_key=request.api_key, model="claude-3-opus-20240229")
            llm.invoke("Hello")
        else:
            raise HTTPException(status_code=400, detail="Invalid provider")
        return {"status": "success", "message": "API Key is valid!"}
    except Exception as e:
        # Log the full error for debugging
        print(f"API Key Test Failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid API Key or Model Unavailable: {str(e)}")
