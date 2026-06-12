package main

import (
	"encoding/csv"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/shivam23singh24/core-api/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	godotenv.Load(".env")
	db, _ := gorm.Open(postgres.Open(os.Getenv("DATABASE_URL")), &gorm.Config{})

	// Friday June 12, 2026
	url := "https://archives.nseindia.com/products/content/sec_bhavdata_full_12062026.csv"
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatal("Failed to download Bhavcopy:", err)
	}
	defer resp.Body.Close()

	reader := csv.NewReader(resp.Body)
	records, err := reader.ReadAll()
	if err != nil {
		log.Fatal("Failed to parse CSV:", err)
	}

	prices := make(map[string]float64)
	changes := make(map[string]float64)

	// Headers: SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER
	for i, row := range records {
		if i == 0 || len(row) < 9 {
			continue
		}
		sym := strings.TrimSpace(row[0])
		series := strings.TrimSpace(row[1])
		if series != "EQ" {
			continue
		}
		
		prevClose, _ := strconv.ParseFloat(strings.TrimSpace(row[3]), 64)
		closePrice, _ := strconv.ParseFloat(strings.TrimSpace(row[8]), 64)
		
		if prevClose > 0 {
			chg := ((closePrice - prevClose) / prevClose) * 100
			prices[sym] = closePrice
			changes[sym] = chg
		}
	}

	var stocks []models.UniverseEquity
	db.Where("is_active = ?", true).Find(&stocks)

	updated := 0
	for _, st := range stocks {
		if p, ok := prices[st.Ticker]; ok {
			st.LastPrice = p
			st.ChangePercent = changes[st.Ticker]
			db.Save(&st)
			updated++
		}
	}
	log.Printf("Successfully synced REAL Friday closing prices for %d stocks!", updated)
}
