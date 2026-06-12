package scraper

import (
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
)

func StartFundamentalsMiner() {
	log.Println("Starting Background Fundamentals Miner (Yahoo Scraper)...")

	go func() {
		for {
			var stocks []models.UniverseEquity
			// Find stocks that need updating (either PE is 0, or hasn't been updated recently). For MVP, we'll just cycle through all of them slowly.
			if err := db.DB.Where("is_active = ?", true).Order("updated_at ASC").Limit(100).Find(&stocks).Error; err != nil {
				log.Println("Fundamentals Miner: Error fetching stocks:", err)
				time.Sleep(10 * time.Minute)
				continue
			}

			if len(stocks) == 0 {
				time.Sleep(1 * time.Hour)
				continue
			}

			for _, stock := range stocks {
				scrapeYahooFinance(&stock)
				// Save to DB
				db.DB.Save(&stock)

				// Sleep to avoid rate limits (2 to 5 seconds)
				sleepDur := time.Duration(2000+rand.Intn(3000)) * time.Millisecond
				time.Sleep(sleepDur)
			}
		}
	}()
}

func scrapeYahooFinance(stock *models.UniverseEquity) {
	// Format ticker for Yahoo Finance
	symbol := stock.Ticker
	if stock.Region == "India" {
		if !strings.HasSuffix(symbol, ".NS") && !strings.HasSuffix(symbol, ".BO") {
			symbol = symbol + ".NS"
		}
	}

	url := fmt.Sprintf("https://finance.yahoo.com/quote/%s", symbol)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}
	html := string(bodyBytes)

	// We use regex to extract the JSON state that Yahoo embeds in the HTML
	stock.TrailingPE = extractFloat(html, `"trailingPE":{"raw":([0-9.]+)`)
	stock.EPS = extractFloat(html, `"trailingEps":{"raw":([0-9.-]+)`)
	stock.PBRatio = extractFloat(html, `"priceToBook":{"raw":([0-9.]+)`)
	stock.MarketCapVal = extractFloat(html, `"marketCap":{"raw":([0-9.]+)`)

	// Clear the random dummy data
	if stock.Catalyst != "Pending AI Analysis" {
		stock.Catalyst = "Pending AI Analysis"
		stock.Moat = "Pending AI Analysis"
		stock.Risk = "Pending AI Analysis"
		stock.Type = "Pending"
	}

	// Dynamic Sector categorization for missing ones
	if stock.Sector == "Other Listed Equities" || stock.Sector == "SME Emerge" {
		sector := extractString(html, `"sector":"([^"]+)"`)
		industry := extractString(html, `"industry":"([^"]+)"`)
		if sector != "" {
			stock.Sector = sector
		}
		if industry != "" {
			stock.SubIndustry = industry
		}
	}
}

func extractFloat(html, pattern string) float64 {
	re := regexp.MustCompile(pattern)
	matches := re.FindStringSubmatch(html)
	if len(matches) > 1 {
		val, _ := strconv.ParseFloat(matches[1], 64)
		return val
	}
	return 0
}

func extractString(html, pattern string) string {
	re := regexp.MustCompile(pattern)
	matches := re.FindStringSubmatch(html)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}
