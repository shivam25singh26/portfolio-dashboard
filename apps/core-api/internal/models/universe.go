package models

import "time"

type UniverseEquity struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Ticker      string    `gorm:"uniqueIndex;not null" json:"ticker"`
	Company     string    `gorm:"not null" json:"company"`
	Region      string    `gorm:"index;not null" json:"region"`
	Sector      string    `gorm:"not null" json:"sector"`
	SubIndustry string    `json:"sub_industry"`
	Cap           string    `json:"cap"`
	Type          string    `json:"type"`
	LastPrice     float64   `json:"last_price"`
	ChangePercent float64   `json:"change_percent"`
	TrailingPE    float64   `json:"trailing_pe"`
	EPS           float64   `json:"eps"`
	PBRatio       float64   `json:"pb_ratio"`
	MarketCapVal  float64   `json:"market_cap_val"`
	ROE             float64   `json:"roe"`
	ROCE            float64   `json:"roce"`
	DebtToEquity    float64   `json:"debt_to_equity"`
	DividendYield   float64   `json:"dividend_yield"`
	PromoterHolding float64   `json:"promoter_holding"`
	SalesGrowth     float64   `json:"sales_growth"`
	ProfitGrowth    float64   `json:"profit_growth"`
	Catalyst      string    `json:"catalyst"`
	Moat        string    `json:"moat"`
	Risk        string    `json:"risk"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

type PriceTick struct {
	Ticker        string  `json:"ticker"`
	LastPrice     float64 `json:"last_price"`
	ChangePercent float64 `json:"change_percent"`
}
