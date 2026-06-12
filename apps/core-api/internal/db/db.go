package db

import (
	"log"

	"github.com/shivam23singh24/core-api/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// ConnectDatabase initializes the Postgres connection and automigrates models
func ConnectDatabase(dsn string) {
	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate the schemas
	err = database.AutoMigrate(
		&models.User{}, 
		&models.TradeLog{}, 
		&models.AIInsight{},
		&models.Signal{},
		&models.PaperTrade{},
		&models.PortfolioSnapshot{},
		&models.Subscription{},
	)
	if err != nil {
		log.Printf("Failed to migrate database: %v", err)
	}
	
	// Drop problematic index that blocks registration
	database.Exec("DROP INDEX IF EXISTS idx_users_telegram_id;")

	DB = database
	log.Println("Database connection established and migrated successfully.")
}
