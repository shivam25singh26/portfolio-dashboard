package mq

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/shivam23singh24/core-api/internal/angelone"
	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
)

// StartOrderConsumer starts a goroutine to listen to the order_requests queue
func StartOrderConsumer(client *angelone.Client) {
	if Ch == nil {
		log.Println("Cannot start order consumer: RabbitMQ channel is nil")
		return
	}

	msgs, err := Ch.Consume(
		"order_requests", // queue
		"",               // consumer
		true,             // auto-ack
		false,            // exclusive
		false,            // no-local
		false,            // no-wait
		nil,              // args
	)
	if err != nil {
		log.Fatalf("Failed to register an order consumer: %v", err)
	}

	go func() {
		for d := range msgs {
			log.Printf("Received an order request: %s", d.Body)

			var payload map[string]interface{}
			if err := json.Unmarshal(d.Body, &payload); err != nil {
				log.Printf("Error unmarshaling order request: %v", err)
				continue
			}

			symbol, _ := payload["symbol"].(string)
			quantityFloat, _ := payload["quantity"].(float64)
			action, _ := payload["action"].(string)
			
			quantity := int(quantityFloat)

			if symbol == "" || quantity <= 0 || action == "" {
				log.Println("Invalid order request payload")
				continue
			}

			// Map symbol to token
			watchlist := angelone.GetNseWatchlist()
			var token string
			for _, w := range watchlist {
				if w.Symbol == symbol {
					token = w.Token
					break
				}
			}

			if token == "" {
				log.Printf("Could not find token for symbol %s in watchlist", symbol)
				continue
			}

			priceFloat, ok := payload["price"].(float64)
			var limitPriceStr string
			if ok && priceFloat > 0 {
				limitPriceStr = fmt.Sprintf("%.2f", priceFloat)
			} else {
				log.Printf("Invalid or missing limit price for %s", symbol)
				continue
			}

			reqData := angelone.PlaceOrderRequest{
				Variety:         "NORMAL",
				TradingSymbol:   symbol,
				SymbolToken:     token,
				TransactionType: action,
				Exchange:        "NSE",
				OrderType:       "LIMIT",
				ProductType:     "DELIVERY",
				Duration:        "DAY",
				Price:           limitPriceStr,
				SquareOff:       "0",
				StopLoss:        "0",
				Quantity:        fmt.Sprintf("%d", quantity),
			}
			
			log.Printf("🔥 EXECUTING LIVE TRADE via AngelOne 🔥")
			log.Printf("Payload: %+v", reqData)
			
			orderID, err := client.PlaceOrder(reqData)
			var notificationMsg string
			
			if err != nil {
				log.Printf("Order Failed: %v", err)
				notificationMsg = fmt.Sprintf("❌ **Order Failed!**\nAction: %s\nSymbol: %s\nQuantity: %d\nReason: %v", action, symbol, quantity, err)
			} else {
				log.Printf("Order Success! OrderID: %s", orderID)
				
				// Save pending order to database for polling
				tradeLog := models.TradeLog{
					UserID:        1,
					TradingSymbol: symbol,
					OrderType:     "LIMIT",
					Quantity:      quantity,
					Price:         priceFloat,
					Status:        "PENDING",
					OrderID:       orderID,
					ExecutedAt:    time.Now(),
				}
				if err := db.DB.Create(&tradeLog).Error; err != nil {
					log.Printf("Failed to save TradeLog to DB: %v", err)
				}
				
				notificationMsg = fmt.Sprintf("✅ **Order Sent to Exchange!**\nAction: %s\nSymbol: %s\nQuantity: %d\nLimit Price: ₹%s\nOrderID: `%s`\n_Status: PENDING_", action, symbol, quantity, limitPriceStr, orderID)
			}
			
			notifPayload, _ := json.Marshal(map[string]string{
				"type": "notification",
				"message": notificationMsg,
			})
			
			PublishMessage("telegram_broadcast", string(notifPayload))
		}
	}()
}
