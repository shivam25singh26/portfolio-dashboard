package paper

import (
	"fmt"
	"log"
	"time"

	"github.com/shivam23singh24/core-api/internal/binance"
	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
)

// ExecuteTrade simulates placing a trade from an AI signal
func ExecuteTrade(userID uint, signalID uint, quantity int) error {
	var signal models.Signal
	if err := db.DB.First(&signal, signalID).Error; err != nil {
		return err
	}

	var user models.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		return err
	}

	entryPrice := signal.EntryPrice

	if signal.Exchange == "BINANCE" {
		if user.BinanceAPIKey == "" || user.BinanceSecret == "" {
			log.Printf("User %d missing Binance keys for crypto trade", userID)
			return fmt.Errorf("binance API keys not configured")
		}

		actualPrice, err := binance.PlaceMarketOrder(user.BinanceAPIKey, user.BinanceSecret, signal.Symbol, signal.Action, float64(quantity))
		if err != nil {
			log.Printf("Failed to place Binance order for User %d: %v", userID, err)
			return err
		}
		entryPrice = actualPrice
		log.Printf("Executed LIVE Testnet trade for User %d: %s %d %s @ %.2f", userID, signal.Action, quantity, signal.Symbol, entryPrice)
	}

	trade := models.PaperTrade{
		SignalID:   signalID,
		UserID:     userID,
		Symbol:     signal.Symbol,
		Exchange:   signal.Exchange,
		Action:     signal.Action,
		EntryPrice: entryPrice,
		Quantity:   quantity,
		EntryTime:  time.Now(),
		Status:     "OPEN",
	}

	if err := db.DB.Create(&trade).Error; err != nil {
		return err
	}

	log.Printf("Executed paper trade for User %d: %s %d %s @ %.2f", userID, trade.Action, trade.Quantity, trade.Symbol, trade.EntryPrice)
	return nil
}

// GetPortfolio returns the total value, cash balance, and invested value for a user
func GetPortfolio(userID uint) (float64, float64, float64, error) {
	var trades []models.PaperTrade
	if err := db.DB.Where("user_id = ?", userID).Find(&trades).Error; err != nil {
		return 0, 0, 0, err
	}

	totalPnL := 0.0
	investedValue := 0.0
	
	for _, t := range trades {
		if t.Status == "CLOSED" {
			totalPnL += t.PnLAmount
		} else {
			investedValue += t.EntryPrice * float64(t.Quantity)
		}
	}

	initialCapital := 1000000.0 // 10 Lakhs
	cashBalance := initialCapital + totalPnL - investedValue
	totalValue := cashBalance + investedValue

	return totalValue, cashBalance, investedValue, nil
}
