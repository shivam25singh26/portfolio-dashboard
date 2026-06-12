package handlers

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"

	"github.com/shivam23singh24/core-api/internal/mq"
)

// TelegramWebhook structure simplified
type TelegramWebhook struct {
	UpdateID int `json:"update_id"`
	CallbackQuery *struct {
		Data string `json:"data"`
		Message struct {
			MessageID int `json:"message_id"`
			Chat struct {
				ID int `json:"id"`
			} `json:"chat"`
		} `json:"message"`
	} `json:"callback_query"`
}

// HandleTelegramWebhook receives button clicks from Telegram
func HandleTelegramWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var update TelegramWebhook
	if err := json.Unmarshal(body, &update); err != nil {
		log.Printf("Failed to unmarshal telegram webhook: %v", err)
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	// We only care about button clicks (CallbackQueries) for now
	if update.CallbackQuery != nil {
		action := update.CallbackQuery.Data

		if action == "validate_trade" {
			log.Println("User clicked Validate Trade. Pushing job to Python Engine via RabbitMQ...")
			
			// Push a trigger to RabbitMQ for Stage 2 validation
			err := mq.PublishMessage("trade_proposals", `{"type": "trigger_stage2", "message_id": ` + fmt.Sprint(update.CallbackQuery.Message.MessageID) + `}`)
			if err != nil {
				log.Printf("Failed to publish validation job: %v", err)
			}
		} else if action == "execute_trade" {
			log.Println("User clicked Execute Trade. Hitting AngelOne API...")
			// Logic to fetch the trade from DB and execute via AngelOne client goes here
		}
	}

	// Always respond 200 OK to Telegram immediately so it doesn't retry
	w.WriteHeader(http.StatusOK)
}
