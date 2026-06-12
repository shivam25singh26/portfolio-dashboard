package scanner

import (
	"encoding/json"
	"fmt"
	"log"
	"time"
    "strings"

	"github.com/shivam23singh24/core-api/internal/angelone"
	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
	"github.com/shivam23singh24/core-api/internal/mq"
)

// StartOrderPoller runs a background loop to check for order execution updates
func StartOrderPoller(client *angelone.Client) {
	log.Println("Starting Order Poller (15-second intervals)...")
	ticker := time.NewTicker(15 * time.Second)

	go func() {
		for {
			<-ticker.C
			
			// 1. Fetch PENDING orders from DB
			var pendingOrders []models.TradeLog
			if err := db.DB.Where("status = ?", "PENDING").Find(&pendingOrders).Error; err != nil {
				log.Printf("Error fetching pending orders from DB: %v", err)
				continue
			}

			if len(pendingOrders) == 0 {
				continue // Nothing to poll
			}

			// 2. Fetch the AngelOne Order Book
			book, err := client.GetOrderBook()
			if err != nil {
				log.Printf("Order Poller failed to get OrderBook: %v", err)
				continue
			}

			// Map OrderID -> OrderDetails
			bookMap := make(map[string]angelone.OrderDetails)
			for _, o := range book {
				bookMap[o.OrderID] = o
			}

			// 3. Match pending DB orders with Order Book
			for _, dbOrder := range pendingOrders {
				remoteOrder, exists := bookMap[dbOrder.OrderID]
				if !exists {
					continue
				}

				// AngelOne returns orderstatus (e.g. "completed", "rejected", "cancelled", "open")
				status := strings.ToLower(remoteOrder.OrderStatus)
				
				// Final states
				if status == "rejected" || status == "completed" || status == "cancelled" || status == "executed" {
					log.Printf("Order %s updated to %s", dbOrder.OrderID, status)
					
					// Update Database
					dbOrder.Status = strings.ToUpper(status)
					db.DB.Save(&dbOrder)

					// Broadcast notification
					emoji := "ℹ️"
					displayStatus := strings.ToUpper(status)
					
					if status == "completed" || status == "executed" {
						emoji = "🤑"
						displayStatus = "FILLED"
					} else if status == "rejected" {
						emoji = "🚫"
					} else if status == "cancelled" {
						emoji = "🗑"
					}

					msg := fmt.Sprintf("%s **Order Update!**\nSymbol: %s\nAction: %s\nQuantity: %v\nStatus: **%s**", 
						emoji, remoteOrder.TradingSymbol, remoteOrder.TransactionType, remoteOrder.Quantity, displayStatus)
						
					if remoteOrder.Text != "" {
						msg += fmt.Sprintf("\nMessage: %s", remoteOrder.Text)
					}

					notifPayload, _ := json.Marshal(map[string]string{
						"type":    "notification",
						"message": msg,
					})
					mq.PublishMessage("telegram_broadcast", string(notifPayload))
				}
			}
		}
	}()
}
