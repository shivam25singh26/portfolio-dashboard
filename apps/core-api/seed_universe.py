import urllib.request
import csv
import psycopg2
import os
from io import StringIO
import random

DATABASE_URL = "postgresql://postgres.kqqoiwnkgcmupakscdds:C0meback%2313112025%40%24@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

def init_db():
    print("Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("Creating universe_equities table...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS universe_equities (
            id SERIAL PRIMARY KEY,
            ticker VARCHAR(50) UNIQUE NOT NULL,
            company VARCHAR(255) NOT NULL,
            region VARCHAR(50) NOT NULL,
            sector VARCHAR(100) NOT NULL,
            sub_industry VARCHAR(100),
            cap VARCHAR(20),
            type VARCHAR(50),
            catalyst TEXT,
            moat TEXT,
            risk TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create index for faster pagination and filtering
        CREATE INDEX IF NOT EXISTS idx_universe_region ON universe_equities(region);
        CREATE INDEX IF NOT EXISTS idx_universe_ticker ON universe_equities(ticker);
    """)
    conn.commit()
    return conn, cur

def get_placeholder_qualitative(company):
    # Procedural generation for qualitative data until AI Engine is fully live for all 2500+ stocks
    catalysts = [
        "Strong domestic order book and impending margin expansion in upcoming quarters.",
        "Expected breakthrough in core product line and favorable regulatory environment.",
        "Aggressive capacity expansion plan set to complete by year-end, driving top-line growth.",
        "Potential M&A target or strategic restructuring to unlock shareholder value.",
        "Favorable raw material pricing cycle and strong rural/urban demand recovery."
    ]
    
    moats = [
        "High switching costs and deeply entrenched distribution network.",
        "Significant scale advantages and low-cost production leadership.",
        "Patented IP portfolio and strong brand equity in Tier 1/2 markets.",
        "Regulatory licensing monopolies and long-term locked-in vendor contracts.",
        "Network effects and dominant market share in a highly fragmented industry."
    ]
    
    risks = [
        "Vulnerability to raw material inflation and supply chain bottlenecks.",
        "High promoter pledge and potential corporate governance overhang.",
        "Intense pricing competition from unorganized sector and emerging tech disruptors.",
        "Exposure to cyclical macroeconomic slowdowns and interest rate sensitivity.",
        "Regulatory tightening and potential adverse policy shifts by the government."
    ]
    
    return random.choice(catalysts), random.choice(moats), random.choice(risks)

def download_and_seed(conn, cur):
    print("Downloading ind_nifty500list.csv from NSE...")
    nifty500_req = urllib.request.Request(
        'https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv', 
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    
    nifty_sectors = {}
    try:
        nifty_res = urllib.request.urlopen(nifty500_req)
        nifty_csv = nifty_res.read().decode('utf-8')
        nifty_reader = csv.DictReader(StringIO(nifty_csv))
        for row in nifty_reader:
            sym = row.get('Symbol', '').strip()
            ind = row.get('Industry', '').strip()
            if sym and ind:
                nifty_sectors[sym] = ind
    except Exception as e:
        print(f"Failed to fetch NIFTY 500 list: {e}")

    print("Downloading EQUITY_L.csv from NSE...")
    req = urllib.request.Request(
        'https://archives.nseindia.com/content/equities/EQUITY_L.csv', 
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    
    try:
        response = urllib.request.urlopen(req)
        csv_data = response.read().decode('utf-8')
    except Exception as e:
        print(f"Failed to download EQUITY_L: {e}")
        return
        
    reader = csv.DictReader(StringIO(csv_data))
    
    insert_query = """
        INSERT INTO universe_equities 
        (ticker, company, region, sector, sub_industry, cap, type, catalyst, moat, risk) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (ticker) DO UPDATE SET 
            company = EXCLUDED.company,
            sector = EXCLUDED.sector,
            sub_industry = EXCLUDED.sub_industry,
            is_active = TRUE;
    """
    
    count = 0
    batch_data = []
    
    caps = ["Large", "Mid", "Small", "Micro"]
    types = ["established", "aggressive", "speculative"]
    
    print("Processing equities...")
    for row in reader:
        symbol = row.get('SYMBOL', '').strip()
        company = row.get('NAME OF COMPANY', '').strip()
        series = row.get(' SERIES', '').strip()
        
        if series not in ['EQ', 'SM', 'ST'] or not symbol:
            continue
            
        catalyst, moat, risk = get_placeholder_qualitative(company)
        
        if series in ['SM', 'ST']:
            sector = "SME Emerge"
            sub_industry = "Small & Medium Enterprises"
            cap = "Micro"
            stock_type = "speculative"
        else:
            if symbol in nifty_sectors:
                sector = nifty_sectors[symbol]
                sub_industry = "NIFTY 500 Component"
                cap = random.choices(["Large", "Mid"], weights=[40, 60])[0]
                stock_type = random.choices(["established", "aggressive"], weights=[70, 30])[0]
            else:
                sector = "Other Listed Equities"
                sub_industry = "General Listed"
                cap = random.choices(["Small", "Micro"], weights=[40, 60])[0]
                stock_type = random.choices(["aggressive", "speculative"], weights=[50, 50])[0]
            
        batch_data.append((
            symbol, company, "India", sector, sub_industry, cap, stock_type, catalyst, moat, risk
        ))
        count += 1
        
    print(f"Executing batch insert for {count} stocks...")
    psycopg2.extras.execute_batch(cur, insert_query, batch_data)
    conn.commit()
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    import psycopg2.extras
    conn, cur = init_db()
    
    # Clear existing India data just in case of stale data
    cur.execute("DELETE FROM universe_equities WHERE region = 'India'")
    conn.commit()
    
    download_and_seed(conn, cur)
    
    cur.close()
    conn.close()
