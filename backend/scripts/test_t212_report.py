import asyncio
import os
import httpx
from datetime import datetime, timedelta

async def test_report_request():
    """Test the historical report request exactly as Trading 212 documents it."""
    
    # Get credentials from environment or prompt
    api_key = os.getenv("T212_API_KEY")
    api_secret = os.getenv("T212_API_SECRET")
    is_demo_str = os.getenv("T212_IS_DEMO", "false")
    is_demo = is_demo_str.lower() in ("true", "1", "yes")

    if not api_key:
        print("❌ Error: T212_API_KEY environment variable not set.")
        print("Usage: T212_API_KEY=... T212_API_SECRET=... python scripts/test_t212_report.py")
        return

    base_url = "https://demo.trading212.com/api/v0" if is_demo else "https://live.trading212.com/api/v0"

    # Date range - last 30 days to keep it small
    time_to = datetime.now().isoformat() + "Z"
    time_from = (datetime.now() - timedelta(days=30)).isoformat() + "Z"

    print(f"🔄 Testing Trading 212 Historical Report Request")
    print(f"   Base URL: {base_url}")
    print(f"   Time Range: {time_from} to {time_to}")
    print(f"   API Key: {api_key[:5]}...")
    print(f"   API Secret: {'*' * 5 if api_secret else 'None'}")
    print()

    payload = {
        "dataIncluded": {
            "includeDividends": True,
            "includeInterest": True,
            "includeOrders": True,
            "includeTransactions": True
        },
        "timeFrom": time_from,
        "timeTo": time_to
    }
    
    headers = {
        "User-Agent": "FinNexus/1.0",
        "Accept": "application/json"
    }

    try:
        # 1. Validate Connection first
        print("📡 1. Validating Connection (GET /equity/account/info)...")
        async with httpx.AsyncClient(headers=headers) as client:
            auth = (api_key, api_secret) if api_secret else None
            response = await client.get(
                f"{base_url}/equity/account/info",
                auth=auth,
                timeout=10.0
            )
            print(f"   Status: {response.status_code}")
            if response.status_code != 200:
                print(f"   ❌ Failed to validate: {response.text}")
                return
            print("   ✅ Connection Valid")

        # 2. Request Report
        print("\n📡 2. Requesting Report (POST /equity/history/exports)...")
        async with httpx.AsyncClient(headers=headers) as client:
            response = await client.post(
                f"{base_url}/equity/history/exports",
                auth=auth,
                json=payload,
                timeout=30.0
            )

            print(f"   Status Code: {response.status_code}")
            print(f"   Response: {response.text}")

            if response.status_code == 200:
                data = response.json()
                report_id = data.get("reportId") or data.get("id")
                print(f"   ✅ SUCCESS! Report ID: {report_id}")
            elif response.status_code == 403:
                print("   ❌ FORBIDDEN: Missing Permissions.")
                print("   Ensure your API Key has 'History' and 'Orders' scopes enabled.")
            elif response.status_code == 429:
                print("   ❌ RATE LIMITED: Too many requests.")
            else:
                print(f"   ❌ FAILED: {response.status_code}")

    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    asyncio.run(test_report_request())