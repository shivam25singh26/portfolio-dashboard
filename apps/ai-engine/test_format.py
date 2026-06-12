prop = """* **Symbol:** RELIANCE-EQ
* **Target:** 3000
* **Stop Loss:** 2800
* **Reasoning:** Good setup. (Conviction Score: 80/100)"""

sym = "RELIANCE-EQ"
clean_prop = prop
if clean_prop.startswith(f"* **Symbol:** {sym}"):
    clean_prop = clean_prop.replace(f"* **Symbol:** {sym}", "").strip()

print(f"CLEAN PROP:\n{clean_prop}")
