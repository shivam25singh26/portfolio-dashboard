const fs = require('fs');
const path = require('path');

const usTickers = {
  "Information Technology": {
    "Software & Cloud": ["MSFT", "ORCL", "ADBE", "INTU", "NOW", "SNOW", "PLTR", "DDOG"],
    "Semiconductors & Equipment": ["NVDA", "AMD", "QCOM", "AMAT", "TXN", "INTC", "KLAC", "MU"],
    "Internet & Tech Platforms": ["AAPL", "GOOGL", "META"],
    "Cybersecurity & Infrastructure": ["CSCO", "IBM", "PANW", "CRWD", "SNPS", "CDNS"]
  },
  "Health Care": {
    "Pharmaceuticals": ["LLY", "JNJ", "MRK", "ABBV", "PFE", "BMY"],
    "Biotechnology": ["AMGN", "VRTX", "REGN", "GILD"],
    "Medical Devices": ["ABT", "MDT", "SYK", "BSX", "ISRG", "BDX", "ZTS"],
    "Healthcare Services & Managed Care": ["UNH", "ELV", "CI", "TMO"]
  },
  "Financials": {
    "Diversified Banks": ["JPM", "BAC", "C"],
    "Investment Banking & Brokerage": ["MS", "GS", "SCHW", "COIN"],
    "Financial Technology & Payments": ["V", "MA", "AXP", "FI", "ICE", "SPGI"],
    "Insurance & Asset Management": ["BLK", "PGR", "CB", "MMC", "AON"]
  },
  "Consumer Discretionary": {
    "E-Commerce & Internet Retail": ["AMZN", "SHOP"],
    "Automobiles": ["TSLA", "RIVN"],
    "Hotels, Restaurants & Leisure": ["MCD", "BKNG", "SBUX", "CMG", "MAR", "ABNB"],
    "Apparel & Specialty Retail": ["HD", "LOW", "NKE", "TJX", "ORLY", "LULU", "DUOL"]
  },
  "Industrials": {
    "Aerospace & Defense": ["BA", "LMT", "RTX", "GD", "KTOS"],
    "Machinery & Heavy Equipment": ["CAT", "DE", "ITW"],
    "Transportation & Logistics": ["UNP", "UPS", "CSX", "NSC"],
    "Commercial Services & Automation": ["GE", "HON", "ADP", "WM", "SYM", "AXON"]
  },
  "Energy & Materials": {
    "Oil & Gas Exploration": ["CVX", "XOM", "COP", "EOG"],
    "Energy Services & Refining": ["SLB", "MPC", "PSX", "VLO", "OXY"],
    "Specialty Chemicals & Gases": ["LIN", "SHW", "ECL"],
    "Metals & Mining": ["FCX", "NUE", "ALB", "MP"]
  },
  "Communication & Utilities": {
    "Telecommunications": ["T", "VZ", "CMCSA"],
    "Media & Entertainment": ["NFLX", "DIS"],
    "Electric Utilities & Renewables": ["NEE", "SO", "DUK", "CEG", "VST", "TLN"]
  }
};

const europeTickers = {
  "Information Technology": {
    "Semiconductors": ["ASML.AS", "ASM.AS", "IFX.DE", "STM.PA"],
    "Software & Cloud": ["SAP.DE", "SU.PA", "DSY.PA", "TEMN.SW"],
    "IT Services & Hardware": ["CAP.PA", "INF.L", "LOGN.SW", "SOF.BR", "NEXI.MI"]
  },
  "Health Care": {
    "Pharmaceuticals": ["NOVO-B.CO", "AZN.L", "NOVN.SW", "ROG.SW", "SAN.PA", "GSK.L"],
    "Biotechnology & Life Sciences": ["BAYN.DE", "MRK.DE", "UCB.BR", "QGEN.DE"],
    "Medical Devices & Healthcare Services": ["FRE.DE", "SNH.DE"]
  },
  "Financials": {
    "Diversified Banks": ["HSBA.L", "SAN.MC", "BNP.PA", "ISP.MI", "UCG.MI", "BBVA.MC", "CS.PA", "GLE.PA", "DBK.DE", "KBC.BR"],
    "Insurance": ["ALV.DE", "MUV2.DE", "AGEAS.BR"]
  },
  "Consumer Discretionary": {
    "Luxury Goods & Apparel": ["MC.PA", "RMS.PA", "OR.PA", "CDI.PA", "KER.PA", "PUM.DE", "ZAL.DE"],
    "Automobiles": ["BMW.DE", "VOW3.DE", "MBG.DE"],
    "Retail & Leisure": ["ITX.MC", "ADS.DE"]
  },
  "Industrials": {
    "Aerospace & Defense": ["AIR.PA", "SAF.PA", "HO.PA"],
    "Machinery & Transportation": ["SIE.DE", "DPW.DE", "FER.MC", "AENA.MC"],
    "Commercial Services & Infrastructure": ["SGO.PA", "LR.PA", "EN.PA", "RAND.AS", "VNA.DE"]
  },
  "Energy & Materials": {
    "Oil & Gas": ["TTE.PA", "ENI.MI", "BP.L", "SHEL.L", "REP.MC"],
    "Chemicals & Gases": ["BAS.DE", "LIN.DE", "AI.PA", "DSM.AS", "SOLB.BR"],
    "Metals & Mining": ["HEI.DE", "CON.DE"]
  },
  "Consumer Staples & Utilities": {
    "Food & Beverage": ["ULVR.L", "NESN.SW", "BN.PA", "ABI.BR", "HEIA.AS"],
    "Utilities & Telecom": ["ENGI.PA", "IBE.MC", "RWE.DE", "EOAN.DE", "RED.MC", "TEF.MC"]
  }
};

const indiaTickers = require('./india-stocks-curated.js');

const preIpoTickers = {
  "Information Technology": {
    "Artificial Intelligence": ["PRIV.OAI", "PRIV.ANTH", "PRIV.CERE", "PRIV.HUGG", "PRIV.XAI"],
    "Software & Data": ["PRIV.DBRX", "PRIV.CVA", "PRIV.NTN", "PRIV.GHL", "PRIV.SCALE"],
    "Fintech & Payments": ["PRIV.STRIP", "PRIV.REV", "PRIV.CHIM", "PRIV.PLAD", "PRIV.RAMP"]
  },
  "Industrials": {
    "Space & Defense": ["PRIV.SPCX", "PRIV.ANDR", "PRIV.SHLD", "PRIV.RBL", "PRIV.AST"],
    "Robotics & Automation": ["PRIV.FGR", "PRIV.AGST", "PRIV.ZPLN"]
  },
  "Consumer Discretionary": {
    "Gaming & Entertainment": ["PRIV.EPIC", "PRIV.DCOR", "PRIV.RDDT"],
    "E-Commerce & Retail": ["PRIV.SHE", "PRIV.SKM"]
  }
};

function generateSectorData(regionObj) {
  const sectors = [];
  
  for (const [sectorName, subIndustriesObj] of Object.entries(regionObj)) {
    const subs = [];
    
    for (const [subIndustryName, tickers] of Object.entries(subIndustriesObj)) {
      const stocks = tickers.map(t => {
        if (typeof t === 'object' && t !== null) {
          return t;
        }
        
        let companyName = t.split('.')[0] + " Corp";
        if (t.startsWith("PRIV.")) {
           const map = {
             "PRIV.OAI": "OpenAI", "PRIV.ANTH": "Anthropic", "PRIV.CERE": "Cerebras", 
             "PRIV.HUGG": "Hugging Face", "PRIV.XAI": "xAI", "PRIV.DBRX": "Databricks",
             "PRIV.CVA": "Canva", "PRIV.NTN": "Notion", "PRIV.GHL": "GoHighLevel",
             "PRIV.SCALE": "Scale AI", "PRIV.STRIP": "Stripe", "PRIV.REV": "Revolut",
             "PRIV.CHIM": "Chime", "PRIV.PLAD": "Plaid", "PRIV.RAMP": "Ramp",
             "PRIV.SPCX": "SpaceX", "PRIV.ANDR": "Anduril", "PRIV.SHLD": "Shield AI",
             "PRIV.RBL": "Rebellion", "PRIV.EPIC": "Epic Games", "PRIV.DCOR": "Discord"
           };
           companyName = map[t] || (t.replace("PRIV.", "") + " Inc.");
        }
        
        return {
          t: t,
          c: companyName,
          type: t.startsWith("PRIV.") ? "speculative" : ["established", "aggressive", "speculative"][Math.floor(Math.random()*3)],
          cap: t.startsWith("PRIV.") ? "Large" : ["Mega", "Large", "Mid", "Small"][Math.floor(Math.random()*4)],
          catalyst: `Strong secular tailwinds in ${subIndustryName.toLowerCase()} and market expansion.`,
          moat: `Scale, distribution network, and sticky customer base in the ${sectorName} space.`,
          risk: "Macroeconomic slowdown, regulatory changes, or increased competition."
        };
      });

      subs.push({
        name: subIndustryName,
        shift: ["Structural", "Steady-growth", "Cyclical", "Frontier"][Math.floor(Math.random()*4)],
        stocks: stocks
      });
    }

    sectors.push({
      sector: sectorName,
      num: sectorName.substring(0,3).toUpperCase(),
      subs: subs
    });
  }
  return sectors;
}

const finalData = {
  "US": generateSectorData(usTickers),
  "Europe": generateSectorData(europeTickers),
  "India": generateSectorData(indiaTickers),
  "Pre-IPO": generateSectorData(preIpoTickers)
};

fs.mkdirSync(path.join(__dirname, 'dashboard', 'src', 'data'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dashboard', 'src', 'data', 'stocks.json'), JSON.stringify(finalData, null, 2));
console.log("stocks.json created successfully.");
