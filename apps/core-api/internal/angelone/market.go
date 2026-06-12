package angelone

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
)

type MarketDataRequest struct {
	Mode           string              `json:"mode"`
	ExchangeTokens map[string][]string `json:"exchangeTokens"`
}

type MarketDataResponse struct {
	Status    bool   `json:"status"`
	Message   string `json:"message"`
	ErrorCode string `json:"errorcode"`
	Data      struct {
		Fetched []struct {
			Exchange      string  `json:"exchange"`
			TradingSymbol string  `json:"tradingSymbol"`
			SymbolToken   string  `json:"symbolToken"`
			LTP           float64 `json:"ltp"`
		} `json:"fetched"`
	} `json:"data"`
}

// GetLTP fetches the Last Traded Price for a list of NSE symbol tokens
func (c *Client) GetLTP(tokens []string) (map[string]float64, error) {
	reqData := MarketDataRequest{
		Mode: "LTP",
		ExchangeTokens: map[string][]string{
			"NSE": tokens,
		},
	}

	respBody, err := c.doRequest("POST", "/rest/secure/angelbroking/market/v1/quote/", reqData)
	if err != nil {
		return nil, fmt.Errorf("market data request failed: %w", err)
	}

	var marketResp MarketDataResponse
	if err := json.Unmarshal(respBody, &marketResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal market response: %w", err)
	}

	if !marketResp.Status {
		return nil, fmt.Errorf("market data API failed: %s (ErrorCode: %s)", marketResp.Message, marketResp.ErrorCode)
	}

	prices := make(map[string]float64)
	for _, item := range marketResp.Data.Fetched {
		prices[item.TradingSymbol] = item.LTP
	}

	return prices, nil
}

// WatchlistSymbol represents a predefined NSE stock
type WatchlistSymbol struct {
	Token  string `json:"token"`
	Symbol string `json:"symbol"`
	Name   string `json:"name"`
	Cap    string `json:"cap"`
}

var cachedWatchlist []WatchlistSymbol

// GetNseWatchlist returns the list of all NSE F&O tokens from fo_tokens.json
func GetNseWatchlist() []WatchlistSymbol {
	if len(cachedWatchlist) > 0 {
		return cachedWatchlist
	}

	importPath := "./internal/angelone/fo_tokens.json"
	data, err := os.ReadFile(importPath)
	if err != nil {
		log.Printf("Failed to load fo_tokens.json: %v", err)
		return []WatchlistSymbol{}
	}

	if err := json.Unmarshal(data, &cachedWatchlist); err != nil {
		log.Printf("Failed to unmarshal fo_tokens.json: %v", err)
		return []WatchlistSymbol{}
	}

	return cachedWatchlist
}
