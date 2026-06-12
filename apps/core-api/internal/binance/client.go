package binance

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	binance_api "github.com/adshao/go-binance/v2"
)

// Set this to true to route all API calls to the Binance Testnet
var UseTestnet = true

func init() {
	if UseTestnet {
		binance_api.UseTestnet = true
	}
}

func GetClient(apiKey, secretKey string) *binance_api.Client {
	return binance_api.NewClient(apiKey, secretKey)
}

// GetUSDTBalance retrieves the available USDT balance for the user
func GetUSDTBalance(apiKey, secretKey string) (float64, error) {
	client := GetClient(apiKey, secretKey)
	res, err := client.NewGetAccountService().Do(context.Background())
	if err != nil {
		return 0, err
	}

	for _, b := range res.Balances {
		if b.Asset == "USDT" {
			free, _ := strconv.ParseFloat(b.Free, 64)
			return free, nil
		}
	}
	return 0, nil
}

// PlaceMarketOrder executes a paper trade on Binance Testnet
func PlaceMarketOrder(apiKey, secretKey, symbol, side string, quantity float64) (float64, error) {
	client := GetClient(apiKey, secretKey)
	
	orderSide := binance_api.SideTypeBuy
	if strings.ToUpper(side) == "SHORT" || strings.ToUpper(side) == "SELL" {
		orderSide = binance_api.SideTypeSell
	}

	res, err := client.NewCreateOrderService().
		Symbol(symbol).
		Side(orderSide).
		Type(binance_api.OrderTypeMarket).
		Quantity(fmt.Sprintf("%f", quantity)).
		Do(context.Background())

	if err != nil {
		return 0, err
	}

	// Calculate average fill price
	var totalCost float64
	var totalQty float64
	for _, fill := range res.Fills {
		price, _ := strconv.ParseFloat(fill.Price, 64)
		qty, _ := strconv.ParseFloat(fill.Quantity, 64)
		totalCost += price * qty
		totalQty += qty
	}

	if totalQty > 0 {
		return totalCost / totalQty, nil
	}

	// Fallback to simple parse if fills array is empty (unlikely for market orders)
	price, _ := strconv.ParseFloat(res.Price, 64)
	return price, nil
}
