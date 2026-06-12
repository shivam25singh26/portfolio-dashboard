package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
)

type ScreenerRequest struct {
	Query string `json:"query"`
}

// Map user-friendly names to DB columns
var columnMap = map[string]string{
	"market cap":       "(market_cap_val / 10000000)", // Convert raw INR to Crores for the query comparison
	"marketcap":        "(market_cap_val / 10000000)",
	"pe":               "trailing_pe",
	"p/e":              "trailing_pe",
	"price to earning": "trailing_pe",
	"eps":              "eps",
	"price":            "last_price",
	"roe":              "roe",
	"return on equity": "roe",
	"roce":             "roce",
	"return on capital employed": "roce",
	"debt to equity":   "debt_to_equity",
	"d/e":              "debt_to_equity",
	"dividend yield":   "dividend_yield",
	"yield":            "dividend_yield",
	"promoter holding": "promoter_holding",
	"sales growth":     "sales_growth",
	"profit growth":    "profit_growth",
}

// Map logical operators
var logicalMap = map[string]string{
	"AND": " AND ",
	"OR":  " OR ",
	"and": " AND ",
	"or":  " OR ",
}

func RunScreenerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req ScreenerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	query := strings.TrimSpace(req.Query)
	if query == "" {
		// Return all stocks if empty query, limit to 500 for performance
		var stocks []models.UniverseEquity
		db.DB.Limit(500).Find(&stocks)
		json.NewEncoder(w).Encode(stocks)
		return
	}

	sqlQuery, args, err := parseCustomQuery(query)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusBadRequest)
		return
	}

	var stocks []models.UniverseEquity
	// Ensure we only return active stocks, and order by market cap descending
	finalSQL := fmt.Sprintf("is_active = true AND (%s)", sqlQuery)
	if err := db.DB.Where(finalSQL, args...).Order("market_cap_val DESC NULLS LAST").Limit(500).Find(&stocks).Error; err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "Database error: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stocks)
}

func parseCustomQuery(input string) (string, []interface{}, error) {
	// A simple tokenizer to split by AND/OR while preserving them
	// We'll use a regex that matches: (Variable) (Operator) (Number)
	// E.g. "Market Cap > 500" -> "Market Cap", ">", "500"

	// First, replace common words
	input = strings.ReplaceAll(input, "  ", " ")

	// Split by logical operators
	tokens := regexp.MustCompile(`(?i)\s+(AND|OR)\s+`).Split(input, -1)
	logicals := regexp.MustCompile(`(?i)\s+(AND|OR)\s+`).FindAllString(input, -1)

	if len(tokens) == 0 {
		return "", nil, fmt.Errorf("invalid query structure")
	}

	var sqlBuilder strings.Builder
	var args []interface{}

	conditionRegex := regexp.MustCompile(`^([A-Za-z\s/]+)\s*([><=]+)\s*([0-9.]+)$`)

	for i, token := range tokens {
		token = strings.TrimSpace(token)
		matches := conditionRegex.FindStringSubmatch(token)
		if len(matches) != 4 {
			return "", nil, fmt.Errorf("invalid condition: '%s'. Expected format 'Metric > Number'", token)
		}

		rawVar := strings.ToLower(strings.TrimSpace(matches[1]))
		operator := matches[2]
		rawVal := matches[3]

		// Validate column
		dbCol, exists := columnMap[rawVar]
		if !exists {
			return "", nil, fmt.Errorf("unknown metric: '%s'", rawVar)
		}

		// Validate operator
		if operator != ">" && operator != "<" && operator != "=" && operator != ">=" && operator != "<=" {
			return "", nil, fmt.Errorf("invalid operator: '%s'", operator)
		}

		// Validate value
		val, err := strconv.ParseFloat(rawVal, 64)
		if err != nil {
			return "", nil, fmt.Errorf("invalid number: '%s'", rawVal)
		}

		// Append to SQL safely using parameterized queries (?)
		sqlBuilder.WriteString(fmt.Sprintf("%s %s ?", dbCol, operator))
		args = append(args, val)

		// Append logical operator if not the last token
		if i < len(logicals) {
			logicalOp := strings.ToUpper(strings.TrimSpace(logicals[i]))
			sqlBuilder.WriteString(fmt.Sprintf(" %s ", logicalOp))
		}
	}

	return sqlBuilder.String(), args, nil
}
