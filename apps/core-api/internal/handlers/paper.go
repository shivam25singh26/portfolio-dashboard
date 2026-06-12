package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
	"github.com/shivam23singh24/core-api/internal/paper"
)

type ExecuteTradeRequest struct {
	SignalID uint `json:"signal_id"`
	Quantity int  `json:"quantity"`
}

func ExecutePaperTradeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	if userEmail == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", userEmail).First(&user).Error; err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	var req ExecuteTradeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.Quantity <= 0 {
		http.Error(w, "Quantity must be greater than 0", http.StatusBadRequest)
		return
	}

	if err := paper.ExecuteTrade(user.ID, req.SignalID, req.Quantity); err != nil {
		http.Error(w, "Failed to execute paper trade", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Paper trade executed successfully"})
}

func GetPaperPortfolioHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	if userEmail == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", userEmail).First(&user).Error; err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	total, cash, invested, err := paper.GetPortfolio(user.ID)
	if err != nil {
		http.Error(w, "Failed to fetch portfolio", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_value":    total,
		"cash_balance":   cash,
		"invested_value": invested,
	})
}

func GetPaperHistoryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	if userEmail == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", userEmail).First(&user).Error; err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	var trades []models.PaperTrade
	if err := db.DB.Where("user_id = ?", user.ID).Order("created_at desc").Find(&trades).Error; err != nil {
		http.Error(w, "Failed to fetch trade history", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trades)
}
