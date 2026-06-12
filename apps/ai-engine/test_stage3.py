from llm import run_stage3_validator
import logging
logging.basicConfig(level=logging.INFO)

dummy_trades = """
* **Symbol:** RELIANCE-EQ
* **Target:** 3000
* **Stop Loss:** 2800
* **Reasoning:** Good setup.
---
* **Symbol:** SBIN-EQ
* **Target:** 900
* **Stop Loss:** 800
* **Reasoning:** Breakout.
"""

print(run_stage3_validator(dummy_trades))
