package scraper

import (
	"encoding/csv"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
	"gorm.io/gorm/clause"
)

func StartIPOSync() {
	log.Println("Starting Automated IPO Sync (Runs daily at 02:00 IST)...")

	go func() {
		for {
			now := time.Now()
			loc, err := time.LoadLocation("Asia/Kolkata")
			if err != nil {
				loc = time.Local
			}
			nowIST := now.In(loc)

			// Calculate time until next 2:00 AM IST
			nextRun := time.Date(nowIST.Year(), nowIST.Month(), nowIST.Day(), 2, 0, 0, 0, loc)
			if nowIST.After(nextRun) {
				nextRun = nextRun.Add(24 * time.Hour)
			}

			sleepDuration := nextRun.Sub(nowIST)
			log.Printf("Automated IPO Sync sleeping for %v. Next run at %v", sleepDuration, nextRun)
			time.Sleep(sleepDuration)

			log.Println("Waking up to sync NSE Universe (IPO Discovery)...")
			syncUniverse()
		}
	}()
}

func syncUniverse() {
	nifty500Sectors := fetchNifty500Sectors()
	
	req, _ := http.NewRequest("GET", "https://archives.nseindia.com/content/equities/EQUITY_L.csv", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Println("IPO Sync failed to download EQUITY_L.csv:", err)
		return
	}
	defer resp.Body.Close()

	reader := csv.NewReader(resp.Body)
	records, err := reader.ReadAll()
	if err != nil {
		log.Println("IPO Sync failed to parse CSV:", err)
		return
	}

	if len(records) < 2 {
		return
	}

	headers := records[0]
	symIdx, nameIdx, seriesIdx := -1, -1, -1
	for i, h := range headers {
		h = strings.TrimSpace(h)
		if h == "SYMBOL" { symIdx = i }
		if h == "NAME OF COMPANY" { nameIdx = i }
		if h == " SERIES" || h == "SERIES" { seriesIdx = i }
	}

	if symIdx == -1 || nameIdx == -1 || seriesIdx == -1 {
		log.Println("IPO Sync failed: Missing columns in EQUITY_L.csv")
		return
	}

	var batch []models.UniverseEquity

	for i := 1; i < len(records); i++ {
		row := records[i]
		if len(row) <= seriesIdx { continue }

		symbol := strings.TrimSpace(row[symIdx])
		company := strings.TrimSpace(row[nameIdx])
		series := strings.TrimSpace(row[seriesIdx])

		if symbol == "" || (series != "EQ" && series != "SM" && series != "ST") {
			continue
		}

		sector := "Other Listed Equities"
		subIndustry := "General Listed"
		cap := "Small"
		stockType := "Pending"

		if series == "SM" || series == "ST" {
			sector = "SME Emerge"
			subIndustry = "Small & Medium Enterprises"
			cap = "Micro"
		} else if nSect, exists := nifty500Sectors[symbol]; exists {
			sector = nSect
			subIndustry = "NIFTY 500 Component"
			cap = "Large"
			if rand.Float32() > 0.5 { cap = "Mid" } // Temp heuristic, Fundamentals Miner will fix MarketCap later
		}

		equity := models.UniverseEquity{
			Ticker:      symbol,
			Company:     company,
			Region:      "India",
			Sector:      sector,
			SubIndustry: subIndustry,
			Cap:         cap,
			Type:        stockType,
			Catalyst:    "Pending AI Analysis",
			Moat:        "Pending AI Analysis",
			Risk:        "Pending AI Analysis",
			IsActive:    true,
		}
		batch = append(batch, equity)
	}

	if len(batch) > 0 {
		// Bulk Upsert using GORM clause
		err := db.DB.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "ticker"}},
			DoUpdates: clause.AssignmentColumns([]string{"company", "sector", "sub_industry", "is_active"}),
		}).CreateInBatches(batch, 500).Error
		
		if err != nil {
			log.Println("IPO Sync Bulk Upsert failed:", err)
		} else {
			log.Printf("IPO Sync completed successfully. Upserted %d stocks.", len(batch))
		}
	}
}

func fetchNifty500Sectors() map[string]string {
	niftyMap := make(map[string]string)
	req, _ := http.NewRequest("GET", "https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return niftyMap
	}
	defer resp.Body.Close()

	reader := csv.NewReader(resp.Body)
	records, err := reader.ReadAll()
	if err != nil || len(records) < 2 {
		return niftyMap
	}

	headers := records[0]
	symIdx, indIdx := -1, -1
	for i, h := range headers {
		if strings.TrimSpace(h) == "Symbol" { symIdx = i }
		if strings.TrimSpace(h) == "Industry" { indIdx = i }
	}

	if symIdx != -1 && indIdx != -1 {
		for i := 1; i < len(records); i++ {
			if len(records[i]) > indIdx {
				niftyMap[strings.TrimSpace(records[i][symIdx])] = strings.TrimSpace(records[i][indIdx])
			}
		}
	}
	return niftyMap
}
