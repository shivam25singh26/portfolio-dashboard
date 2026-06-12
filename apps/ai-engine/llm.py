import os
import json
from dotenv import load_dotenv
from langchain_groq import ChatGroq
import requests
from langchain_core.prompts import PromptTemplate

load_dotenv()

# Helper to fetch news with fallback
def fetch_stock_news(symbols: list, max_per_symbol: int = 2) -> str:
    """Fetch stock-specific news headlines.
    Tries DuckDuckGo first, then falls back to NewsAPI if a key is provided.
    Returns a newline‑separated string of headlines.
    """
    import logging, json
    headlines = []
    # Primary source: DuckDuckGo
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            for sym in symbols[:5]:
                results = ddgs.news(f"{sym} stock India", max_results=max_per_symbol)
                if results:
                    for r in results:
                        headlines.append(f"[{sym}] {r.get('title', '')}")
        if headlines:
            return "\n".join(headlines)
    except Exception as e:
        logging.getLogger(__name__).warning(f"DuckDuckGo news fetch failed: {e}")
    # Secondary source: NewsAPI (optional)
    newsapi_key = os.getenv('NEWSAPI_KEY')
    if newsapi_key:
        try:
            for sym in symbols[:5]:
                params = {'q': f"{sym} stock India", 'pageSize': max_per_symbol, 'apiKey': newsapi_key, 'language': 'en'}
                resp = requests.get('https://newsapi.org/v2/everything', params=params, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    for article in data.get('articles', []):
                        headlines.append(f"[{sym}] {article.get('title', '')}")
            if headlines:
                return "\n".join(headlines)
        except Exception as e:
            logging.getLogger(__name__).warning(f"NewsAPI fetch failed: {e}")
    return "No recent significant news found for these stocks."


# Initialize the LLMs
def get_stage1_llm():
    # Switching to Llama 4 Scout (17B) since we maxed out Llama 3.1 8B's daily token limit
    return ChatGroq(model="meta-llama/llama-4-scout-17b-16e-instruct", temperature=0.0, model_kwargs={"seed": 42})

def get_stage2_llm():
    # Alibaba's Qwen 3 32B (Logical Filtering)
    return ChatGroq(model="qwen/qwen3-32b", temperature=0.0, model_kwargs={"seed": 42})

def get_stage3_llm():
    # Meta's Llama 3.3 70B (State-of-the-art Validation)
    return ChatGroq(model="llama-3.3-70b-versatile", temperature=0.0, model_kwargs={"seed": 42})

def run_stage1_screening(market_data_batch: list, risk_profile: str, count: int) -> str:
    """Stage 1: Generates a large raw batch of trades in JSON."""
    llm = get_stage1_llm()
    prompt = PromptTemplate.from_template(
        """You are the Chief Quantitative Strategist for a hedge fund. 
        You have been provided with real-time JSON market data for {risk_profile} stocks.
        (Note: 's' = Symbol, 'p' = Last Traded Price).
        
        Market Data Batch: {market_data}
        
        Your mandate:
        1. Evaluate the provided market data.
        2. Identify UP TO {count} highly favorable trade setups (both LONG and SHORT).
        3. CRITICAL: At least HALF of the trades must be SHORT setups, if any trades are found.
        4. CRITICAL: Only include trades if your conviction is VERY HIGH (minimum 85%). If no setups meet this bar, output an empty array: []
        5. Provide a strict entry target, stop loss, and a 1-sentence reasoning.

        OUTPUT FORMAT:
        Output a valid JSON array of objects. Do NOT include any conversational text, markdown formatting, or backticks.
        [
            {{
                "symbol": "TICKER",
                "action": "LONG", 
                "target": 150.00,
                "stop_loss": 140.00,
                "reasoning": "1-2 sentences"
            }}
        ]
        Note: "action" MUST be exactly "LONG" or "SHORT".
        """
    )
    chain = prompt | llm
    result = chain.invoke({
        "market_data": json.dumps(market_data_batch),
        "risk_profile": risk_profile,
        "count": count
    })
    return result.content

def run_stage2_filter(proposals: str, count: int) -> str:
    """Stage 2: Takes trades and ruthlessly filters them down to exact targets using Live News."""
    
    # --- LIVE NEWS SEARCH ---
    try:
        symbols = [p.get("symbol", "").replace("-EQ", "") for p in json.loads(proposals) if p.get("symbol")]
        news_context = fetch_stock_news(symbols)
    except Exception as e:
        news_context = f"Could not fetch live news: {e}"

    llm = get_stage2_llm()
    prompt = PromptTemplate.from_template(
        """You are a strict Risk Manager evaluating a batch of proposed trades.
        
        Raw Proposals:
        {proposals}
        
        LIVE STOCK NEWS CONTEXT:
        {news_context}
        
        Your mandate:
        1. Evaluate every single proposed trade.
        2. CROSS-REFERENCE WITH LIVE NEWS: If a stock is proposed as LONG but the news is terrible (lawsuits, earnings miss), you MUST DROP IT or switch it to SHORT!
        3. If a stock is proposed as SHORT and the news confirms bad performance, increase your conviction!
        4. You MUST filter this list down to UP TO {count} high-conviction trades (minimum 85%). If NO trades meet this bar, output an empty array: []
        
        OUTPUT FORMAT:
        Output a valid JSON array of UP TO {count} objects. Do NOT include any conversational text or markdown backticks.
        [
            {{
                "symbol": "TICKER",
                "action": "LONG", 
                "target": 150.00,
                "stop_loss": 140.00,
                "reasoning": "1-2 sentences including news validation"
            }}
        ]
        """
    )
    chain = prompt | llm
    result = chain.invoke({
        "proposals": proposals,
        "news_context": news_context,
        "count": count
    })
    return result.content

def run_stage3_validator(filtered_trades: str) -> str:
    """Stage 3: Final sanity check and conviction scoring using Macro Geopolitics."""
    
    # --- MACRO NEWS SEARCH ---
    macro_context = ""
    # Primary: DuckDuckGo
    try:
        from ddgs import DDGS
        macro_headlines = []
        with DDGS() as ddgs:
            results = ddgs.news("Indian stock market Nifty Sensex today", max_results=3)
            if results:
                for r in results:
                    macro_headlines.append(f"{r.get('title', '')}")
        if macro_headlines:
            macro_context = "\n".join(macro_headlines)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"DuckDuckGo macro news failed: {e}")
    # Fallback: NewsAPI
    if not macro_context:
        newsapi_key = os.getenv('NEWSAPI_KEY')
        if newsapi_key:
            try:
                params = {'q': 'Indian stock market Nifty Sensex', 'pageSize': 3, 'apiKey': newsapi_key, 'language': 'en', 'sortBy': 'publishedAt'}
                resp = requests.get('https://newsapi.org/v2/everything', params=params, timeout=5)
                if resp.status_code == 200:
                    articles = resp.json().get('articles', [])
                    macro_context = "\n".join(a.get('title', '') for a in articles)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"NewsAPI macro news failed: {e}")
    if not macro_context:
        macro_context = "Market sentiment neutral. No major geopolitical events."

    llm = get_stage3_llm()
    prompt = PromptTemplate.from_template(
        """You are the Chief Investment Officer. 
        The Risk Desk has approved the following final trades:
        
        {filtered_trades}
        
        MACRO MARKET & GEOPOLITICAL CONTEXT:
        {macro_context}
        
        Your mandate:
        1. Review every trade objectively against the MACRO CONTEXT. If the market is crashing due to geopolitics, be extremely cautious with LONG trades.
        2. CRITICAL: We optimize for a 70-90% Win-Loss Ratio. ONLY approve trades with a conviction score of 85% or higher (ideally > 95%).
        3. If NO trades meet this incredibly strict bar, output an empty array: []
        4. Do NOT feel pressured to return trades just because they were proposed. Quality over quantity.
        5. Assign a conviction_score (0-100) and rewrite the reasoning to explain exactly why this trade is approved, factoring in the macro environment if relevant.
        
        OUTPUT FORMAT:
        Output a valid JSON array of objects. Add the "conviction_score" key to each object. Do NOT include conversational text or markdown backticks.
        [
            {{
                "symbol": "TICKER",
                "action": "LONG",
                "target": 150.00,
                "stop_loss": 140.00,
                "conviction_score": "95",
                "reasoning": "..."
            }}
        ]
        """
    )
    chain = prompt | llm
    result = chain.invoke({
        "filtered_trades": filtered_trades,
        "macro_context": macro_context
    })
    return result.content
