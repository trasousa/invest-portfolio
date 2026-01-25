from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
import bcrypt

import os

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey") # Fallback for dev, override in prod
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

from cryptography.fernet import Fernet
import base64

# Generate a key derived from SECRET_KEY for Fernet (must be 32 url-safe base64-encoded bytes)
# In a real app, this should be a separate stable key.
# For now, we'll derive it or use a fixed fallback if SECRET_KEY is not suitable.
def _get_fernet():
    # Ensure key is 32 bytes
    key = SECRET_KEY.encode()
    if len(key) < 32:
        key = key.ljust(32, b'=')
    elif len(key) > 32:
        key = key[:32]
    
    # Fernet requires a base64 encoded 32-byte key
    return Fernet(base64.urlsafe_b64encode(key))

def encrypt_string(txt: str) -> str:
    if not txt: return None
    f = _get_fernet()
    return f.encrypt(txt.encode()).decode()

def decrypt_string(txt: str) -> str:
    if not txt: return None
    f = _get_fernet()
    return f.decrypt(txt.encode()).decode()
