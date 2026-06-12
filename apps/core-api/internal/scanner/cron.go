package scanner

import (
	"encoding/json"
	"log"
	"time"

	"github.com/shivam23singh24/core-api/internal/angelone"
	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/handlers"
	"github.com/shivam23singh24/core-api/internal/models"
	"github.com/shivam23singh24/core-api/internal/mq"
)

// MarketData represents a simplified view of the data we send to Python
type MarketData struct {
	Symbol string  `json:"symbol"`
	Token  string  `json:"token"`
	LTP    float64 `json:"ltp"`
	Volume int64   `json:"volume"`
	Cap    string  `json:"cap"`
}

// StartHourlyScanner initiates a custom scheduler that runs at specific IST times
func StartHourlyScanner(client *angelone.Client) {
	log.Println("Starting IST Market Scanner (08:45, 10:00, 12:00, 14:00, 15:15)...")
	
	loc, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		log.Println("WARNING: Could not load Asia/Kolkata. Falling back to Local.")
		loc = time.Local
	}

	// Target times in HH:MM format
	targetTimes := []string{"08:45", "10:00", "12:00", "14:00", "15:15"}

	// Fire immediately on boot
	log.Println("Initial Scanner Wakeup. Fetching market data...")
	go RunScan(client)

	go func() {
		for {
			now := time.Now().In(loc)
			var nextRun time.Time
			found := false

			for _, tStr := range targetTimes {
				t, _ := time.ParseInLocation("15:04", tStr, loc)
				candidate := time.Date(now.Year(), now.Month(), now.Day(), t.Hour(), t.Minute(), 0, 0, loc)
				
				if candidate.After(now) {
					nextRun = candidate
					found = true
					break
				}
			}

			// If no target time left today, schedule for the first target time tomorrow
			if !found {
				t, _ := time.ParseInLocation("15:04", targetTimes[0], loc)
				nextRun = time.Date(now.Year(), now.Month(), now.Day()+1, t.Hour(), t.Minute(), 0, 0, loc)
			}

			waitDuration := nextRun.Sub(now)
			log.Printf("Scanner sleeping for %v. Next run scheduled at: %v IST\n", waitDuration.Round(time.Second), nextRun.Format("15:04:05"))
			
			time.Sleep(waitDuration)
			
			// Ignore weekends (Saturday=6, Sunday=0)
			wakeupDay := time.Now().In(loc).Weekday()
			if wakeupDay != time.Saturday && wakeupDay != time.Sunday {
				log.Println("Scanner woke up on schedule. Fetching market data...")
				RunScan(client)
			} else {
				log.Println("Scanner woke up but it's the weekend. Skipping scan.")
			}
		}
	}()
}

func RunScan(client *angelone.Client) {
	watchlist := angelone.GetNseWatchlist()
	if len(watchlist) == 0 {
		return
	}
	
	var tokens []string
	for _, w := range watchlist {
		tokens = append(tokens, w.Token)
	}

	prices := make(map[string]float64)
	chunkSize := 40
	for i := 0; i < len(tokens); i += chunkSize {
		end := i + chunkSize
		if end > len(tokens) {
			end = len(tokens)
		}
		
		batch := tokens[i:end]
		batchPrices, err := client.GetLTP(batch)
		if err != nil {
			log.Printf("Failed to fetch live prices for batch: %v", err)
			continue
		}
		for k, v := range batchPrices {
			prices[k] = v
		}
		time.Sleep(200 * time.Millisecond) // avoid rate limits
	}

	var batchData []MarketData
	for _, w := range watchlist {
		ltp, ok := prices[w.Symbol]
		if !ok || ltp == 0 {
			continue
		}

		data := MarketData{
			Symbol: w.Symbol,
			Token:  w.Token,
			LTP:    ltp,
			Volume: 100000, // Volume might require a different endpoint, using mock for now
			Cap:    w.Cap,
		}
		batchData = append(batchData, data)
	}

	if len(batchData) > 0 {
		// Broadcast to WebSockets and Save to DB
		for _, bd := range batchData {
			// Update DB
			db.DB.Model(&models.UniverseEquity{}).Where("ticker = ?", bd.Symbol).Update("last_price", bd.LTP)
			
			// Broadcast WebSocket
			select {
			case handlers.PriceBroadcast <- models.PriceTick{
				Ticker:    bd.Symbol,
				LastPrice: bd.LTP,
			}:
			default:
				// Channel full, drop tick
			}
		}

		payload, err := json.Marshal(batchData)
		if err != nil {
			log.Printf("Failed to marshal batch market data: %v", err)
			return
		}

		// Push entire batch to RabbitMQ for Python to evaluate at once
		err = mq.PublishMessage("market_scans", string(payload))
		if err != nil {
			log.Printf("Failed to publish batched market scan: %v", err)
		} else {
			log.Printf("Successfully published live market scan batch (%d stocks) to queue", len(batchData))
		}
	}
}
