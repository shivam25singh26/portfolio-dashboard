package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/shivam23singh24/core-api/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	godotenv.Load(".env")
	dsn := os.Getenv("DATABASE_URL")
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	db.Exec(`ALTER TABLE universe_equities ADD COLUMN IF NOT EXISTS last_price numeric;`)
	db.Exec(`ALTER TABLE universe_equities ADD COLUMN IF NOT EXISTS change_percent numeric;`)
	db.Exec(`ALTER TABLE universe_equities ADD COLUMN IF NOT EXISTS trailing_pe numeric;`)
	db.Exec(`ALTER TABLE universe_equities ADD COLUMN IF NOT EXISTS eps numeric;`)
	db.Exec(`ALTER TABLE universe_equities ADD COLUMN IF NOT EXISTS pb_ratio numeric;`)
	db.Exec(`ALTER TABLE universe_equities ADD COLUMN IF NOT EXISTS market_cap_val numeric;`)
	
	err = db.AutoMigrate(&models.UniverseEquity{})
	if err != nil {
		log.Println("Migrate error:", err)
	} else {
		log.Println("Migrate successful")
	}
}
