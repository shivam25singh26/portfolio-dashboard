package angelone

import (
	"encoding/json"
	"fmt"
)

type PlaceOrderRequest struct {
	Variety         string `json:"variety"`
	TradingSymbol   string `json:"tradingsymbol"`
	SymbolToken     string `json:"symboltoken"`
	TransactionType string `json:"transactiontype"` // BUY or SELL
	Exchange        string `json:"exchange"`        // NSE, BSE, NFO
	OrderType       string `json:"ordertype"`       // MARKET, LIMIT
	ProductType     string `json:"producttype"`     // INTRADAY, DELIVERY
	Duration        string `json:"duration"`        // DAY, IOC
	Price           string `json:"price"`           // 0 for market
	SquareOff       string `json:"squareoff"`
	StopLoss        string `json:"stoploss"`
	Quantity        string `json:"quantity"`
}

type PlaceOrderResponse struct {
	Status    bool            `json:"status"`
	Message   string          `json:"message"`
	ErrorCode string          `json:"errorcode"`
	Data      json.RawMessage `json:"data"`
}

type PlaceOrderData struct {
	Script  string `json:"script"`
	OrderID string `json:"orderid"`
}

// PlaceOrder submits a new order to AngelOne
func (c *Client) PlaceOrder(reqData PlaceOrderRequest) (string, error) {
	respBody, err := c.doRequest("POST", "/rest/secure/angelbroking/order/v1/placeOrder", reqData)
	if err != nil {
		return "", fmt.Errorf("place order request failed: %w", err)
	}

	var orderResp PlaceOrderResponse
	if err := json.Unmarshal(respBody, &orderResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal order response: %w, raw body: %s", err, string(respBody))
	}

	if !orderResp.Status {
		return "", fmt.Errorf("order failed: %s (ErrorCode: %s)", orderResp.Message, orderResp.ErrorCode)
	}

	var data PlaceOrderData
	if len(orderResp.Data) > 0 && string(orderResp.Data) != `""` && string(orderResp.Data) != `null` {
		if err := json.Unmarshal(orderResp.Data, &data); err != nil {
			return "", fmt.Errorf("failed to unmarshal order data: %w", err)
		}
	}

	return data.OrderID, nil
}

type OrderDetails struct {
	Variety         string `json:"variety"`
	OrderType       string `json:"ordertype"`
	ProductType     string `json:"producttype"`
	Duration        string `json:"duration"`
	Price           interface{} `json:"price"`
	TriggerPrice    interface{} `json:"triggerprice"`
	Quantity        interface{} `json:"quantity"`
	DisclosedQuantity interface{} `json:"disclosedquantity"`
	SquareOff       interface{} `json:"squareoff"`
	StopLoss        interface{} `json:"stoploss"`
	TrailingStopLoss interface{} `json:"trailingstoploss"`
	TradingSymbol   string `json:"tradingsymbol"`
	TransactionType string `json:"transactiontype"`
	Exchange        string `json:"exchange"`
	SymbolToken     string `json:"symboltoken"`
	InstrumentType  string `json:"instrumenttype"`
	StrikePrice     interface{} `json:"strikeprice"`
	OptionType      string `json:"optiontype"`
	ExpiryDate      string `json:"expirydate"`
	LotSize         interface{} `json:"lotsize"`
	CancelSize      interface{} `json:"cancelsize"`
	AveragePrice    interface{} `json:"averageprice"`
	FilledShares    interface{} `json:"filledshares"`
	UnfilledShares  interface{} `json:"unfilledshares"`
	OrderID         string `json:"orderid"`
	Text            string `json:"text"`
	Status          string `json:"status"`
	OrderStatus     string `json:"orderstatus"`
	UpdateTime      string `json:"updatetime"`
	ExchangeTime    string `json:"exchtime"`
	ExchangeOrderUpdateTime string `json:"exchorderupdatetime"`
	FillID          string `json:"fillid"`
	FillTime        string `json:"filltime"`
}

type OrderBookResponse struct {
	Status    bool           `json:"status"`
	Message   string         `json:"message"`
	ErrorCode string         `json:"errorcode"`
	Data      []OrderDetails `json:"data"`
}

// GetOrderBook retrieves all orders for the day
func (c *Client) GetOrderBook() ([]OrderDetails, error) {
	respBody, err := c.doRequest("GET", "/rest/secure/angelbroking/order/v1/getOrderBook", nil)
	if err != nil {
		return nil, fmt.Errorf("get order book request failed: %w", err)
	}

	var bookResp OrderBookResponse
	if err := json.Unmarshal(respBody, &bookResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal order book response: %w", err)
	}

	if !bookResp.Status {
		return nil, fmt.Errorf("get order book failed: %s (ErrorCode: %s)", bookResp.Message, bookResp.ErrorCode)
	}

	return bookResp.Data, nil
}
