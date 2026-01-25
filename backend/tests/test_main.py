from fastapi.testclient import TestClient

def test_portfolio_flow(client: TestClient):
    # 1. Sign up a new user
    user_data = {"email": "test_portfolio@example.com", "password": "password123"}
    signup_response = client.post("/api/auth/signup", json=user_data)
    assert signup_response.status_code == 200

    # 2. Login to get token
    login_data = {"username": user_data["email"], "password": user_data["password"]}
    login_response = client.post("/api/auth/token", data=login_data)
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Add a Holding (was create_stock)
    # Using a known ticker or mock data. Using 'AAPL' for simplicity.
    holding_data = {
        "security_symbol": "AAPL",
        "quantity": 10,
        "avg_cost": 150.0,
        "asset_type": "stock",
        "currency": "USD"
    }
    # Note: This might try to fetch real data because of get_stock_info in the router.
    # ideally we mock the price service, but for a simple fix we'll try it.
    # If it fails due to network/mocking, we can catch it.
    
    # We will try to rely on the fallback logic in create_holding if external API fails,
    # or simple success if it works.
    create_response = client.post("/api/holdings/", json=holding_data, headers=headers)
    
    # If external API calls fail in the test environment, we might get an error or a fallback.
    # Let's assert it's 200 or print the error.
    assert create_response.status_code == 200, f"Create holding failed: {create_response.text}"
    data = create_response.json()
    assert data["quantity"] == 10
    assert data["avg_cost"] == 150.0

    # 4. Get Holdings (was read_main /api/stocks)
    get_response = client.get("/api/holdings/", headers=headers)
    assert get_response.status_code == 200
    holdings = get_response.json()
    assert len(holdings) >= 1
    assert holdings[0]["security"]["symbol"] == "AAPL"

    # 5. Get Portfolio Summary
    summary_response = client.get("/api/portfolio/summary", headers=headers)
    assert summary_response.status_code == 200
    summary = summary_response.json()
    # Values might be zero if price fetch failed, but structure should be valid
    assert "total_value" in summary
    assert "total_assets" in summary