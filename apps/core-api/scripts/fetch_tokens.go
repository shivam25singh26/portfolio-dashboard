package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
)

type Scrip struct {
	Token          string `json:"token"`
	Symbol         string `json:"symbol"`
	Name           string `json:"name"`
	Expiry         string `json:"expiry"`
	Strike         string `json:"strike"`
	Lotsize        string `json:"lotsize"`
	InstrumentType string `json:"instrumenttype"`
	ExchSeg        string `json:"exch_seg"`
	TickSize       string `json:"tick_size"`
}

type WatchlistSymbol struct {
	Token  string `json:"token"`
	Symbol string `json:"symbol"`
	Name   string `json:"name"`
	Cap    string `json:"cap"`  // Large/Mid/Small (Mocked for now)
}

func main() {
	log.Println("Downloading AngelOne ScripMaster JSON...")
	resp, err := http.Get("https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json")
	if err != nil {
		log.Fatalf("Failed to download ScripMaster: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Failed to read body: %v", err)
	}

	log.Println("Parsing JSON...")
	var scrips []Scrip
	if err := json.Unmarshal(body, &scrips); err != nil {
		log.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	// 1. Find all F&O stock names (FUTSTK in NFO)
	foNames := make(map[string]bool)
	for _, s := range scrips {
		if s.ExchSeg == "NFO" && s.InstrumentType == "FUTSTK" {
			foNames[s.Name] = true
		}
	}
	log.Printf("Found %d unique F&O stock names in NFO.", len(foNames))

	// 2. Find the corresponding Cash Market tokens in NSE
	var tokens []WatchlistSymbol
	for _, s := range scrips {
		if s.ExchSeg == "NSE" && s.Symbol == s.Name+"-EQ" {
			if foNames[s.Name] {
				// We found an NSE Cash Market token for an F&O stock!
				// Determine rough Cap/Risk based on popular names for testing
				capClass := "Mid/Small"
				// A small hardcoded list of known huge large caps for safe trades
				largeCaps := map[string]bool{
					"RELIANCE": true, "TCS": true, "HDFCBANK": true, "ICICIBANK": true,
					"INFY": true, "ITC": true, "SBIN": true, "LT": true,
					"BHARTIARTL": true, "BAJFINANCE": true, "HINDUNILVR": true,
					"KOTAKBANK": true, "AXISBANK": true, "ASIANPAINT": true,
					"MARUTI": true, "SUNPHARMA": true, "TITAN": true,
				}
				if largeCaps[s.Name] {
					capClass = "Large"
				}

				tokens = append(tokens, WatchlistSymbol{
					Token:  s.Token,
					Symbol: s.Symbol,
					Name:   s.Name,
					Cap:    capClass,
				})
			}
		}
	}

	log.Printf("Successfully mapped %d NSE Cash tokens for F&O stocks.", len(tokens))

	// Write to fo_tokens.json
	outPath := "../internal/angelone/fo_tokens.json"
	outData, _ := json.MarshalIndent(tokens, "", "  ")
	err = os.WriteFile(outPath, outData, 0644)
	if err != nil {
		log.Fatalf("Failed to write %s: %v", outPath, err)
	}

	log.Printf("Successfully saved to %s", outPath)
}
