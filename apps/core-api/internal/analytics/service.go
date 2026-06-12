package analytics

import (
	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
)

type SummaryStats struct {
	TotalTrades  int     `json:"total_trades"`
	WinRate      float64 `json:"win_rate"`
	AvgReturn    float64 `json:"avg_return"`
	TotalPnL     float64 `json:"total_pnl"`
	TotalPnLPct  float64 `json:"total_pnl_pct"`
	WinningTrades int    `json:"winning_trades"`
	LosingTrades  int    `json:"losing_trades"`
}

func GetSummaryStats(userID uint) (*SummaryStats, error) {
	var trades []models.PaperTrade
	if err := db.DB.Where("user_id = ? AND status = ?", userID, "CLOSED").Find(&trades).Error; err != nil {
		return nil, err
	}

	stats := &SummaryStats{
		TotalTrades: len(trades),
	}

	if len(trades) == 0 {
		return stats, nil
	}

	var totalReturnPct float64
	for _, t := range trades {
		stats.TotalPnL += t.PnLAmount
		stats.TotalPnLPct += t.PnLPercent
		totalReturnPct += t.PnLPercent

		if t.PnLAmount > 0 {
			stats.WinningTrades++
		} else if t.PnLAmount < 0 {
			stats.LosingTrades++
		}
	}

	stats.WinRate = float64(stats.WinningTrades) / float64(stats.TotalTrades) * 100
	stats.AvgReturn = totalReturnPct / float64(stats.TotalTrades)

	return stats, nil
}

type EquityPoint struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
}

func GetEquityCurve(userID uint) ([]EquityPoint, error) {
	var snapshots []models.PortfolioSnapshot
	// Assuming you record snapshot per day, let's get the last 30 snapshots
	if err := db.DB.Where("user_id = ?", userID).Order("date asc").Limit(30).Find(&snapshots).Error; err != nil {
		return nil, err
	}

	var curve []EquityPoint
	for _, s := range snapshots {
		curve = append(curve, EquityPoint{
			Date:  s.Date.Format("2006-01-02"),
			Value: s.TotalValue,
		})
	}
	
	// If no snapshots, at least return today's value based on starting 10,00,000 + current pnl
	if len(curve) == 0 {
		// Just a fallback
		curve = append(curve, EquityPoint{
			Date:  "Today",
			Value: 1000000, 
		})
	}

	return curve, nil
}
