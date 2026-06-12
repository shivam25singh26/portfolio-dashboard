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
	db, _ := gorm.Open(postgres.Open(os.Getenv("DATABASE_URL")), &gorm.Config{})
	
	var count int64
	db.Model(&models.UniverseEquity{}).Where("is_active = true").Count(&count)
	log.Println("Active equities:", count)

	var priceCount int64
	db.Model(&models.UniverseEquity{}).Where("last_price > 0").Count(&priceCount)
	log.Println("Equities with last_price > 0:", priceCount)
}
