package paper

import (
	"log"
	"time"

	"github.com/shivam23singh24/core-api/internal/angelone"
	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
)

// StartTracker polls live prices and closes paper trades if target/stop loss is hit
func StartTracker(angelClient *angelone.Client) {
	ticker := time.NewTicker(30 * time.Second)
	go func() {
		for range ticker.C {
			checkOpenTrades(angelClient)
		}
	}()
}

func checkOpenTrades(client *angelone.Client) {
	var openTrades []models.PaperTrade
	if err := db.DB.Where("status = ?", "OPEN").Find(&openTrades).Error; err != nil {
		log.Printf("Tracker error fetching open trades: %v", err)
		return
	}

	if len(openTrades) == 0 {
		return
	}

	// Create a map of symbol -> token
	watchlist := angelone.GetNseWatchlist()
	symbolToToken := make(map[string]string)
	for _, item := range watchlist {
		symbolToToken[item.Symbol] = item.Token
	}

	// Gather tokens to fetch LTP
	tokenSet := make(map[string]bool)
	var tokens []string
	for _, t := range openTrades {
		if token, exists := symbolToToken[t.Symbol]; exists {
			if !tokenSet[token] {
				tokenSet[token] = true
				tokens = append(tokens, token)
			}
		}
	}

	if len(tokens) == 0 {
		return
	}

	// Fetch LTP
	prices, err := client.GetLTP(tokens)
	if err != nil {
		log.Printf("Tracker error fetching LTP: %v", err)
		return
	}

	// Fetch corresponding signals for Target/SL checking
	var signalIDs []uint
	for _, t := range openTrades {
		signalIDs = append(signalIDs, t.SignalID)
	}

	var signals []models.Signal
	if err := db.DB.Where("id IN ?", signalIDs).Find(&signals).Error; err != nil {
		log.Printf("Tracker error fetching signals: %v", err)
		return
	}

	signalMap := make(map[uint]models.Signal)
	for _, s := range signals {
		signalMap[s.ID] = s
	}

	for _, t := range openTrades {
		ltp, ok := prices[t.Symbol]
		if !ok {
			continue
		}

		sig, ok := signalMap[t.SignalID]
		if !ok {
			continue
		}

		shouldClose := false
		exitReason := ""

		if t.Action == "LONG" {
			if ltp >= sig.Target {
				shouldClose = true
				exitReason = "TARGET"
			} else if ltp <= sig.StopLoss {
				shouldClose = true
				exitReason = "STOP_LOSS"
			}
		} else if t.Action == "SHORT" {
			if ltp <= sig.Target {
				shouldClose = true
				exitReason = "TARGET"
			} else if ltp >= sig.StopLoss {
				shouldClose = true
				exitReason = "STOP_LOSS"
			}
		}

		if shouldClose {
			closeTrade(&t, ltp, exitReason)
		}
	}
}

func closeTrade(trade *models.PaperTrade, exitPrice float64, reason string) {
	trade.ExitPrice = exitPrice
	trade.ExitTime = time.Now()
	trade.ExitReason = reason
	trade.Status = "CLOSED"

	// Calculate PnL
	if trade.Action == "LONG" {
		trade.PnLAmount = (exitPrice - trade.EntryPrice) * float64(trade.Quantity)
		trade.PnLPercent = ((exitPrice - trade.EntryPrice) / trade.EntryPrice) * 100
	} else {
		trade.PnLAmount = (trade.EntryPrice - exitPrice) * float64(trade.Quantity)
		trade.PnLPercent = ((trade.EntryPrice - exitPrice) / trade.EntryPrice) * 100
	}

	if err := db.DB.Save(trade).Error; err != nil {
		log.Printf("Failed to close paper trade %d: %v", trade.ID, err)
		return
	}

	log.Printf("Closed paper trade for User %d: %s %d %s @ %.2f (Reason: %s, PnL: %.2f)", trade.UserID, trade.Action, trade.Quantity, trade.Symbol, exitPrice, reason, trade.PnLAmount)
	
	// TODO: Trigger Telegram notification via RabbitMQ for trade exit
}
