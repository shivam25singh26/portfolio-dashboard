package mq

import (
	"encoding/json"
	"log"

	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
)

// StartConsumer starts a goroutine to listen to the trade_proposals queue
func StartConsumer() {
	if Ch == nil {
		log.Println("Cannot start consumer: RabbitMQ channel is nil")
		return
	}

	msgs, err := Ch.Consume(
		"trade_proposals", // queue
		"",                // consumer
		true,              // auto-ack
		false,             // exclusive
		false,             // no-local
		false,             // no-wait
		nil,               // args
	)
	if err != nil {
		log.Fatalf("Failed to register a consumer: %v", err)
	}

	go func() {
		for d := range msgs {
			log.Printf("Received a trade proposal: %s", d.Body)

			// The python engine sends a JSON payload: {"type": "stage1_result", "proposal": "..."}
			var payload map[string]interface{}
			if err := json.Unmarshal(d.Body, &payload); err != nil {
				log.Printf("Error unmarshaling message: %v", err)
				continue
			}

			if msgType, ok := payload["type"].(string); ok && msgType == "truncate_db" {
				log.Println("Truncating ai_insights table before new batch...")
				db.DB.Exec("TRUNCATE TABLE ai_insights")
				continue
			}

			// Extract direct fields from the JSON payload (No more regex!)
			symbol, _ := payload["symbol"].(string)
			if symbol == "" {
				log.Println("Skipping trade: missing symbol")
				continue
			}

			ltpVal, _ := payload["ltp"].(float64)
			target, _ := payload["target"].(float64)
			stopLoss, _ := payload["stop_loss"].(float64)
			action, _ := payload["action"].(string)
			reasoning, _ := payload["reasoning"].(string)
			convictionScore, _ := payload["conviction_score"].(string)
			
			capStr, _ := payload["cap"].(string)
			exchangeStr, ok := payload["exchange"].(string)
			if !ok {
				exchangeStr = "NSE"
			}
			riskStr := "Risky"
			if capStr == "Large" {
				riskStr = "Safe"
			}

			if action == "" {
				action = "LONG" // Fallback
			}

			// Save to Postgres (legacy table - truncated every batch)
			insight := models.AIInsight{
				Symbol:          symbol,
				Exchange:        exchangeStr,
				Ltp:             ltpVal,
				Target:          target,
				StopLoss:        stopLoss,
				Action:          action,
				Risk:            riskStr,
				Reasoning:       reasoning,
				ConvictionScore: convictionScore,
				RawText:         "JSON Mode", // No longer needed
			}

			if err := db.DB.Create(&insight).Error; err != nil {
				log.Printf("Failed to save AIInsight to DB: %v", err)
			} else {
				log.Printf("Successfully saved AIInsight for %s to DB", symbol)
			}

			// Save to new Signal table (persistent for track record)
			signal := models.Signal{
				Symbol:          symbol,
				Exchange:        exchangeStr,
				Action:          action,
				EntryPrice:      ltpVal, // Using LTP as entry price
				Target:          target,
				StopLoss:        stopLoss,
				ConvictionScore: convictionScore,
				Reasoning:       reasoning,
				Status:          "ACTIVE",
				// TODO: Pass these strings from Python
				// NewsContext: payload["news_context"],
				// Stage1Raw: payload["stage1_raw"],
				// Stage2Filtered: payload["stage2_filtered"],
				// Stage3Final: payload["stage3_final"],
			}

			if err := db.DB.Create(&signal).Error; err != nil {
				log.Printf("Failed to save Signal to DB: %v", err)
			} else {
				log.Printf("Successfully saved Signal for %s to DB", symbol)
			}
		}
	}()
}
