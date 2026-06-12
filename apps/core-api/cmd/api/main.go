package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/shivam23singh24/core-api/internal/angelone"
	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/handlers"
	"github.com/shivam23singh24/core-api/internal/models"
	"github.com/shivam23singh24/core-api/internal/mq"
	"github.com/shivam23singh24/core-api/internal/paper"
	"github.com/shivam23singh24/core-api/internal/scanner"

	"github.com/joho/godotenv"
	"github.com/pquerna/otp/totp"
)

func main() {
	// Load .env variables early so we can use them for DB and MQ
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found or error loading it")
	}

	// Initialize PostgreSQL Database connection
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=admin password=password dbname=copilot_db port=5432 sslmode=disable"
	}
	db.ConnectDatabase(dsn)

	// Drop the legacy unique constraint on telegram_id to allow multi-tenant web signups
	db.DB.Exec("DROP INDEX IF EXISTS idx_users_telegram_id;")

	// Initialize RabbitMQ
	amqpURL := os.Getenv("AMQP_URL")
	if amqpURL == "" {
		amqpURL = "amqp://admin:password@localhost:5672/"
	}
	mq.ConnectRabbitMQ(amqpURL)
	defer mq.Conn.Close()
	defer mq.Ch.Close()

	// Start consuming trade proposals from AI Engine
	mq.StartConsumer()

	// Load .env variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found or error loading it")
	}

	// Initialize AngelOne Client (Credentials will come from ENV variables later)
	clientID := os.Getenv("ANGELONE_CLIENT_ID")
	pin := os.Getenv("ANGELONE_PIN")
	apiKey := os.Getenv("ANGELONE_API_KEY")
	totpSecret := os.Getenv("ANGELONE_TOTP_SECRET")

	client := angelone.NewClient(apiKey, clientID, pin)

	// Automatically authenticate on boot
	if totpSecret != "" {
		passcode, err := totp.GenerateCode(totpSecret, time.Now())
		if err == nil {
			err = client.GenerateSession(passcode)
			if err != nil {
				log.Printf("Failed to auto-login to AngelOne: %v", err)
			} else {
				log.Println("Successfully authenticated with AngelOne API")
			}
		} else {
			log.Printf("Failed to generate TOTP: %v", err)
		}
	}
	
	// Start consuming execution requests
	mq.StartOrderConsumer(client)

	// Start the Background Market Scanner
	scanner.StartHourlyScanner(client)
	scanner.StartCryptoScanner()

	// Start the Background Order Poller
	scanner.StartOrderPoller(client)

	// Start the Paper Trading Tracker
	paper.StartTracker(client)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Fintech Core Gateway Running")
	})

	// Register the Telegram Webhook Handler
	http.HandleFunc("/webhook/telegram", handlers.HandleTelegramWebhook)

	http.HandleFunc("/api/trigger-scan", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		go scanner.RunScan(client)
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"scanning"}`)
	})

	http.HandleFunc("/api/trigger-crypto", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		go scanner.RunCryptoScan()
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"crypto_scanning"}`)
	})

	http.HandleFunc("/api/nse-market", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")

		watchlist := angelone.GetNseWatchlist()
		var tokens []string
		for _, w := range watchlist {
			tokens = append(tokens, w.Token)
		}

		prices, err := client.GetLTP(tokens)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		// Structure the response to match frontend expectations
		type NSEStock struct {
			Symbol string  `json:"t"`
			Name   string  `json:"c"`
			Price  float64 `json:"price"`
		}

		var result []NSEStock
		for _, w := range watchlist {
			result = append(result, NSEStock{
				Symbol: w.Symbol,
				Name:   w.Name,
				Price:  prices[w.Symbol],
			})
		}

		json.NewEncoder(w).Encode(result)
	})

	http.HandleFunc("/api/insights", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")

		var signals []models.Signal
		// Fetch the latest active signals
		if err := db.DB.Where("status = ?", "ACTIVE").Order("created_at DESC").Limit(50).Find(&signals).Error; err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "%v"}`, err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(signals)
	})

	// Universe Expansion Route
	http.HandleFunc("/api/universe", handlers.HandleUniverse)

	// User Routes
	http.HandleFunc("/api/users/register", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		handlers.RegisterHandler(w, r)
	})

	http.HandleFunc("/api/users/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		handlers.LoginHandler(w, r)
	})

	// User Settings endpoints
	http.HandleFunc("/api/users/profile", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		handlers.UpdateProfileHandler(w, r)
	})
	http.HandleFunc("/api/users/password", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		handlers.UpdatePasswordHandler(w, r)
	})
	http.HandleFunc("/api/users/binance", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		handlers.UpdateBinanceHandler(w, r)
	})
	http.HandleFunc("/api/users/2fa/generate", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		handlers.Generate2FAHandler(w, r)
	})
	http.HandleFunc("/api/users/2fa/verify", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		handlers.Verify2FAHandler(w, r)
	})

	// Admin endpoints
	http.HandleFunc("/api/admin/users", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		handlers.AdminUsersHandler(w, r)
	})
	http.HandleFunc("/api/admin/users/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "DELETE, PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		if r.Method == http.MethodDelete || r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") == "DELETE" {
			handlers.AdminDeleteUserHandler(w, r)
		} else if r.Method == http.MethodPut || r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") == "PUT" {
			handlers.AdminUpdateUserHandler(w, r)
		} else if r.Method == http.MethodOptions {
		    w.WriteHeader(http.StatusOK)
		}
	})

	// Paper Trading endpoints
	http.HandleFunc("/api/paper/execute", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		handlers.ExecutePaperTradeHandler(w, r)
	})
	http.HandleFunc("/api/paper/portfolio", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		handlers.GetPaperPortfolioHandler(w, r)
	})
	http.HandleFunc("/api/paper/history", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		handlers.GetPaperHistoryHandler(w, r)
	})

	// Analytics Endpoints
	http.HandleFunc("/api/analytics/summary", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		handlers.GetAnalyticsSummaryHandler(w, r)
	})
	http.HandleFunc("/api/analytics/equity-curve", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Email")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		handlers.GetEquityCurveHandler(w, r)
	})

	log.Println("Starting Go Gateway on :8080...")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
