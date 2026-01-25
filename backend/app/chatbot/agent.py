from typing import List, Optional
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.chat_models import ChatOllama
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from sqlalchemy.orm import Session
from app.chatbot.tools import StockSearchTool, PortfolioTool, CashTool

SYSTEM_PROMPT = """You are Finn, an advanced AI financial assistant for the FinNexus app.
Your goal is to help users manage their wealth, analyze their portfolio, and provide financial insights.

You have access to the user's portfolio data, cash transactions, and real-time stock information.
- When asked about the portfolio, use the 'get_portfolio' tool. This provides holdings, sector, industry, and market allocation.
- When asked about cash, savings, or expenses, use the 'get_cash_transactions' tool.
- When asked about specific stocks, use the 'stock_search' tool.
- Provide concise, actionable advice.
- If you analyze the portfolio, look for diversification issues (e.g., too much in one sector or market) or high-risk concentrations.
- Be friendly, professional, and encouraging.

User Context:
- The user has connected their accounts to FinNexus.
- You are chatting directly with the user.
"""

class FinnAgent:
    def __init__(self, db: Session, user_id: int, user_settings: dict, provider: Optional[str] = None):
        self.db = db
        self.user_id = user_id
        self.tools = [StockSearchTool(), PortfolioTool(db=db, user_id=user_id), CashTool(db=db, user_id=user_id)]
        
        # Select model based on provider or settings priority
        print(f"DEBUG: Provider={provider}, Settings Keys={list(user_settings.keys())}")
        
        if provider == "openai" or (not provider and user_settings.get("openai_api_key")):
            if not user_settings.get("openai_api_key"):
                 print("DEBUG: OpenAI key missing in settings")
                 raise ValueError("OpenAI API key not found.")
            self.llm = ChatOpenAI(
                api_key=user_settings["openai_api_key"],
                model="gpt-4o-mini", # Updated to latest efficient model
                temperature=0.7
            )
        elif provider == "gemini" or (not provider and user_settings.get("gemini_api_key")):
            if not user_settings.get("gemini_api_key"):
                 print("DEBUG: Gemini key missing in settings")
                 raise ValueError("Gemini API key not found.")
            self.llm = ChatGoogleGenerativeAI(
                google_api_key=user_settings["gemini_api_key"],
                model="gemini-2.0-flash", # Updated to latest efficient model
                temperature=0.7
            )
        elif provider == "ollama" or (not provider and user_settings.get("ollama_url")):
            ollama_url = user_settings.get("ollama_url", "http://localhost:11434")
            print(f"DEBUG: Using Ollama at {ollama_url}")
            self.llm = ChatOllama(
                base_url=ollama_url,
                model="llama3", # Default to llama3, could be configurable
                temperature=0.7
            )
        else:
            print("DEBUG: No valid provider/key match found")
            raise ValueError("No valid API key found. Please configure an API key in Settings.")

    def get_executor(self):
        prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="chat_history"),
            ("user", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        agent = create_tool_calling_agent(self.llm, self.tools, prompt)
        return AgentExecutor(agent=agent, tools=self.tools, verbose=True)

    async def chat(self, message: str, history: List[dict] = []):
        executor = self.get_executor()
        
        # Convert history to LangChain format if needed
        # For now, we'll just pass the message as input and let the agent handle it
        # In a real app, we'd manage memory properly
        
        result = await executor.ainvoke({
            "input": message,
            "chat_history": history 
        })
        
        return result["output"]
