from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
from llm import run_stage1_screening, run_stage2_validation

app = FastAPI(title="AI & Data Engine")

class ScanRequest(BaseModel):
    market_data: dict

class ValidateRequest(BaseModel):
    proposal: str
    fundamental_news: str

@app.get("/")
def read_root():
    return {"status": "Python AI Engine is running"}

@app.post("/scan")
def trigger_scan(req: ScanRequest):
    # Run Stage 1 LLM screening
    proposal = run_stage1_screening(req.market_data)
    return {"status": "success", "proposal": proposal}

@app.post("/validate")
def validate_trade(req: ValidateRequest):
    # Run Stage 2 validation
    final_critique = run_stage2_validation(req.proposal, req.fundamental_news)
    return {"status": "success", "critique": final_critique}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
