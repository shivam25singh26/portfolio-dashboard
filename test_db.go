package main
import (
	"log"
	"os"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"github.com/shivam23singh24/core-api/internal/models"
)
func main() {
	godotenv.Load(".env")
	db, _ := gorm.Open(postgres.Open(os.Getenv("DATABASE_URL")), &gorm.Config{})
	var count int64
	db.Model(&models.UniverseEquity{}).Where("is_active = true").Count(&count)
	log.Println("Active equities:", count)
}
