package main

import (
	"log"
	"math/rand"
	"os"

	"github.com/joho/godotenv"
	"github.com/shivam23singh24/core-api/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	godotenv.Load(".env")
	db, _ := gorm.Open(postgres.Open(os.Getenv("DATABASE_URL")), &gorm.Config{})

	var stocks []models.UniverseEquity
	db.Where("is_active = ?", true).Find(&stocks)

	for _, st := range stocks {
		if st.LastPrice == 0 {
			st.LastPrice = 50 + rand.Float64()*2950
			st.ChangePercent = -5 + rand.Float64()*10
		}
		if st.TrailingPE == 0 {
			st.TrailingPE = 10 + rand.Float64()*70
			st.EPS = 5 + rand.Float64()*45
			st.PBRatio = 1 + rand.Float64()*5
			st.MarketCapVal = (10 + rand.Float64()*490) * 1000000000 // 10B to 500B
		}
		db.Save(&st)
	}

	log.Printf("Successfully backfilled %d stocks with temporary UI metrics", len(stocks))
}
