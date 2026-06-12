package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
)

type PaginatedUniverse struct {
	Stocks []models.UniverseEquity `json:"stocks"`
	Total  int64                   `json:"total"`
	Page   int                     `json:"page"`
	Pages  int                     `json:"pages"`
}

func HandleUniverse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")
	region := r.URL.Query().Get("region")
	query := r.URL.Query().Get("q")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 5000 {
		limit = 50 // Default 50 items per page
	}

	offset := (page - 1) * limit

	var equities []models.UniverseEquity
	var total int64

	tx := db.DB.Model(&models.UniverseEquity{}).Where("is_active = ?", true)

	if region != "" && region != "all" {
		tx = tx.Where("region = ?", region)
	}

	if query != "" {
		tx = tx.Where("ticker ILIKE ? OR company ILIKE ?", "%"+query+"%", "%"+query+"%")
	}

	// Count total records for pagination info
	tx.Count(&total)

	// Fetch paginated records
	if err := tx.Order("cap ASC, ticker ASC").Offset(offset).Limit(limit).Find(&equities).Error; err != nil {
		http.Error(w, "Failed to fetch universe", http.StatusInternalServerError)
		return
	}

	pages := int(total) / limit
	if int(total)%limit != 0 {
		pages++
	}

	response := PaginatedUniverse{
		Stocks: equities,
		Total:  total,
		Page:   page,
		Pages:  pages,
	}

	json.NewEncoder(w).Encode(response)
}
