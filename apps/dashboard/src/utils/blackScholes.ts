// Cumulative distribution function for standard normal distribution
export function cdf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

// Standard normal probability density function
export function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export interface BSParams {
  S: number; // Spot price
  K: number; // Strike price
  t: number; // Time to expiry in years
  r: number; // Risk-free interest rate (e.g., 0.07 for 7%)
  v: number; // Volatility (e.g., 0.20 for 20%)
  type: "CE" | "PE";
}

export function calculateBlackScholes({ S, K, t, r, v, type }: BSParams): number {
  // If expiry is essentially today or past, intrinsic value is the price
  if (t <= 0.0001) {
    if (type === "CE") return Math.max(0, S - K);
    if (type === "PE") return Math.max(0, K - S);
  }

  // Handle edge case of 0 volatility to prevent division by zero
  const vol = Math.max(v, 0.001); 

  const d1 = (Math.log(S / K) + (r + (vol * vol) / 2) * t) / (vol * Math.sqrt(t));
  const d2 = d1 - vol * Math.sqrt(t);

  if (type === "CE") {
    return S * cdf(d1) - K * Math.exp(-r * t) * cdf(d2);
  } else {
    return K * Math.exp(-r * t) * cdf(-d2) - S * cdf(-d1);
  }
}

// Calculate delta (often used as a rough proxy for Probability of Profit)
export function calculateDelta({ S, K, t, r, v, type }: BSParams): number {
  if (t <= 0) {
    if (type === "CE") return S > K ? 1 : 0;
    if (type === "PE") return S < K ? -1 : 0;
  }
  const vol = Math.max(v, 0.001);
  const d1 = (Math.log(S / K) + (r + (vol * vol) / 2) * t) / (vol * Math.sqrt(t));
  
  if (type === "CE") return cdf(d1);
  return cdf(d1) - 1;
}

// Helper to convert date strings to years
export function getYearsToExpiry(expiryDateStr: string): number {
  const expiry = new Date(expiryDateStr);
  const now = new Date();
  const diffTime = Math.max(0, expiry.getTime() - now.getTime());
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays / 365.0;
}
