import httpx
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class Trading212Service:
    LIVE_URL = "https://live.trading212.com/api/v0"
    DEMO_URL = "https://demo.trading212.com/api/v0"

    def __init__(self, api_key: str, api_secret: str = None, is_demo: bool = False):
        # Only strip whitespace, don't remove any characters
        self.api_key = api_key.strip() if api_key else ""
        self.api_secret = api_secret.strip() if api_secret else ""
        self.base_url = self.DEMO_URL if is_demo else self.LIVE_URL

        # The API accepts two schemes (see securitySchemes in api.json):
        #   authWithSecretKey  - Basic auth, API Key as user / API Secret as password
        #   legacyApiKeyHeader - the bare API key in the Authorization header
        # Key-only credentials must fall back to the legacy header, otherwise the
        # request goes out with no credentials at all and the API answers 401.
        self.auth = (self.api_key, self.api_secret) if self.api_secret else None

        self.headers = {
            "User-Agent": "FinNexus/1.0",
            "Accept": "application/json"
        }
        if not self.api_secret and self.api_key:
            self.headers["Authorization"] = self.api_key

        logger.info(f"Trading212Service initialized: demo={is_demo}, has_secret={bool(self.api_secret)}")

    async def validate_connection(self) -> bool:
        """Check if the API key is valid by fetching the account summary."""
        try:
            logger.info(f"Validating Trading212 connection to {self.base_url}")
            async with httpx.AsyncClient(headers=self.headers) as client:
                response = await client.get(
                    f"{self.base_url}/equity/account/summary",
                    auth=self.auth,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    logger.info(f"Connection successful! Account info: {response.json()}")
                    return True
                
                logger.error(f"Validation failed: {response.status_code} - {response.text}")
                
                # If rate limited, raise error so caller can handle it
                if response.status_code == 429:
                    response.raise_for_status()
                    
                return False
        except httpx.HTTPStatusError:
            raise # Re-raise status errors to be handled by caller
        except Exception as e:
            logger.error(f"Trading212 connection validation failed: {e}")
            return False

    async def fetch_portfolio(self) -> List[Dict[str, Any]]:
        """
        Fetch all open positions using bulk endpoint.
        Returns positions with instrument metadata including ISINs.
        """
        async with httpx.AsyncClient(headers=self.headers) as client:
            response = await client.get(
                f"{self.base_url}/equity/positions",
                auth=self.auth,
                timeout=15.0
            )
            response.raise_for_status()
            positions = response.json()
            
            # Transform to include both T212 ticker and instrument data
            result = []
            for pos in positions:
                instrument = pos.get("instrument", {})
                result.append({
                    "ticker": instrument.get("ticker", ""),  # T212 format
                    "isin": instrument.get("isin", ""),  # ISIN code
                    "name": instrument.get("name", ""),
                    "type": instrument.get("type", ""),
                    "quantity": pos.get("quantity", 0),
                    "averagePrice": pos.get("averagePricePaid", 0),
                    "currentPrice": pos.get("currentPrice", 0),
                    "instrument": instrument
                })
            
            return result

    async def fetch_cash(self) -> float:
        """Fetch the cash currently available to trade, in the account currency."""
        summary = await self.fetch_account_summary()
        cash = summary.get("cash") or {}
        return cash.get("availableToTrade", 0.0)

    async def fetch_account_summary(self) -> Dict[str, Any]:
        """Fetch the account summary (id, currency, cash and investment totals)."""
        async with httpx.AsyncClient(headers=self.headers) as client:
            response = await client.get(
                f"{self.base_url}/equity/account/summary",
                auth=self.auth,
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()

    async def fetch_instrument_metadata(self) -> List[Dict[str, Any]]:
        """Fetch metadata for all instruments."""
        async with httpx.AsyncClient(headers=self.headers) as client:
            response = await client.get(
                f"{self.base_url}/equity/metadata/instruments",
                auth=self.auth,
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()

    async def fetch_dividends(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch dividend history."""
        async with httpx.AsyncClient(headers=self.headers) as client:
            response = await client.get(
                f"{self.base_url}/equity/history/dividends?limit={limit}",
                auth=self.auth,
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            return data.get("items", [])

    async def fetch_portfolio_history(self) -> List[Dict[str, Any]]:
        """
        Fetch historical portfolio data.
        Note: T212 API might not have a direct 'portfolio history' endpoint.
        We typically reconstruct it from orders or use a specific report endpoint if available.
        For now, we will try to fetch orders to estimate history or return empty if not supported.
        """
        # Placeholder: T212 doesn't have a simple "daily portfolio value history" endpoint.
        # We might need to rely on the user's app history or calculate it.
        # Returning empty list for now to avoid breaking sync.
        return []


    async def request_historical_report(self, time_from: str = None, time_to: str = None) -> str:
        """
        Request a CSV report with historical events (dividends, orders, transactions).
        Uses the /equity/history/exports endpoint per Trading 212 API documentation.
        
        IMPORTANT: This endpoint requires Basic Auth (API Key + API Secret).
        
        Returns the reportId to track status.
        """
        from datetime import datetime, timedelta
        
        if not time_to:
            time_to = datetime.now().isoformat() + "Z"
        if not time_from:
            # Default to 1 year ago
            time_from = (datetime.now() - timedelta(days=365)).isoformat() + "Z"
        
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
        
        async with httpx.AsyncClient(headers=self.headers) as client:
            response = await client.post(
                f"{self.base_url}/equity/history/exports",
                auth=self.auth,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            report_id = data.get("reportId") or data.get("id")
            logger.info(f"Historical report requested: {report_id}")
            return report_id

    async def get_report_status(self, report_id: str = None) -> Dict[str, Any]:
        """
        Get status of reports.
        
        If report_id is provided, get specific report from list.
        Otherwise returns list of all reports.
        """
        async with httpx.AsyncClient(headers=self.headers) as client:
            # Get all reports
            response = await client.get(
                f"{self.base_url}/equity/history/exports",
                auth=self.auth,
                timeout=10.0
            )
            
            response.raise_for_status()
            reports = response.json()
            
            if report_id:
                # Find specific report in list
                for report in reports:
                    if report.get("reportId") == report_id:
                        return report
                raise ValueError(f"Report {report_id} not found")
            
            return reports


    async def download_report_csv(self, report_id: str, save_dir: str) -> str:
        """
        Download the CSV report once it's ready.
        Polls for completion and saves to file.
        
        Args:
            report_id: The report ID from request_historical_report
            save_dir: Directory to save the CSV file
            
        Returns:
            Path to the downloaded CSV file
        """
        import os
        import asyncio
        
        # Poll for report completion
        # Trading 212 rate limit: 1 GET request per 60 seconds
        # Poll every 30 seconds, max 4 attempts (2 minutes total)
        max_attempts = 4
        poll_interval = 30  # seconds
        
        for attempt in range(max_attempts):
            # Wait before polling (except first attempt)
            if attempt > 0:
                logger.info(f"   Waiting {poll_interval} seconds before next status check...")
                await asyncio.sleep(poll_interval)
            
            try:
                status_data = await self.get_report_status(report_id)
                status = status_data.get("status")
                
                logger.info(f"   Report status: {status} (attempt {attempt + 1}/{max_attempts})")
                
                if status == "Finished":
                    download_link = status_data.get("downloadLink")
                    if not download_link:
                        raise ValueError("Download link not provided in completed report")
                    
                    # Download the CSV from S3 (presigned URL - no auth needed)
                    async with httpx.AsyncClient(headers=self.headers) as client:
                        csv_response = await client.get(
                            download_link,
                            # S3 presigned URLs include auth in query params, don't add headers
                            timeout=30.0
                        )
                        csv_response.raise_for_status()
                        
                        # Save to file
                        os.makedirs(save_dir, exist_ok=True)
                        from datetime import datetime
                        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                        filename = f"trading212_events_{timestamp}.csv"
                        filepath = os.path.join(save_dir, filename)
                        
                        with open(filepath, 'wb') as f:
                            f.write(csv_response.content)
                        
                        logger.info(f"   Downloaded report to {filepath}")
                        return filepath
                
                elif status == "Failed":
                    raise ValueError(f"Report generation failed for {report_id}")
                
                # Still generating (status="Processing"), continue polling
                
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning(f"   Rate limited when checking status (attempt {attempt + 1})")
                    # Continue to next attempt after waiting
                    continue
                raise
        
        raise TimeoutError(f"Report {report_id} did not complete within {max_attempts * poll_interval} seconds")
