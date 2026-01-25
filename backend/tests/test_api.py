import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Portfolio Tracker API is running"}

def test_read_api_root():
    response = client.get("/api/")
    assert response.status_code == 200
    assert response.json() == {"message": "Portfolio Tracker API is running"}

def test_auth_signup_login():
    # Signup
    email = "test@example.com"
    password = "password123"
    
    # Clean up if exists (this is a simple test, might fail if user exists)
    # Ideally we use a test DB, but for now we just try to login first
    
    login_response = client.post("/api/auth/token", data={"username": email, "password": password})
    
    if login_response.status_code == 401:
        # User doesn't exist, create it
        signup_response = client.post("/api/auth/signup", json={"email": email, "password": password})
        assert signup_response.status_code == 200
        
        # Login again
        login_response = client.post("/api/auth/token", data={"username": email, "password": password})
        
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    assert token is not None
    
    # Get Profile
    profile_response = client.get("/api/auth/profile", headers={"Authorization": f"Bearer {token}"})
    assert profile_response.status_code == 200
    assert profile_response.json()["email"] == email
