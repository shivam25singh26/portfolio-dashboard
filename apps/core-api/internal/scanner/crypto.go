package scanner

import (
	"context"
	"encoding/json"
	"log"
	"strconv"
	"time"

	"github.com/shivam23singh24/core-api/internal/binance"
	"github.com/shivam23singh24/core-api/internal/mq"
)

// Top liquid crypto pairs for 24/7 scanning
var CryptoWatchlist = []string{"BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT"}

// StartCryptoScanner runs a 24/7 background task for Crypto pairs
// It runs every 15 minutes since Crypto moves much faster than NSE.
func StartCryptoScanner() {
	go func() {
		for {
			// Run every 15 minutes
			time.Sleep(15 * time.Minute)
			log.Println("Starting 15m Crypto Scanner batch...")
			RunCryptoScan()
		}
	}()
}

// RunCryptoScan fetches latest prices from Binance Testnet and queues them for AI
func RunCryptoScan() {
	client := binance.GetClient("", "") // Public endpoints don't need API keys
	
	prices, err := client.NewListPricesService().Do(context.Background())
	if err != nil {
		log.Printf("Failed to fetch Binance prices: %v", err)
		return
	}

	priceMap := make(map[string]float64)
	for _, p := range prices {
		val, _ := strconv.ParseFloat(p.Price, 64)
		priceMap[p.Symbol] = val
	}

	var batch []map[string]interface{}
	for _, symbol := range CryptoWatchlist {
		if ltp, ok := priceMap[symbol]; ok {
			batch = append(batch, map[string]interface{}{
				"symbol":   symbol,
				"ltp":      ltp,
				"exchange": "BINANCE",
				"cap":      "Crypto", // To help AI context
			})
		}
	}

	if len(batch) > 0 {
		// Queue to RabbitMQ for Python AI Engine
		body, _ := json.Marshal(map[string]interface{}{
			"type": "crypto_scan_batch",
			"data": batch,
		})
		
		if err := mq.PublishMessage("market_scans", string(body)); err != nil {
			log.Printf("Failed to publish Crypto scan batch: %v", err)
		} else {
			log.Printf("Successfully published Crypto scan batch (%d pairs) to queue", len(batch))
		}
	}
}
