package main

import (
	"fmt"
	"github.com/shivam23singh24/core-api/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=localhost user=admin password=password dbname=copilot_db port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		fmt.Println("DB error:", err)
		return
	}
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("mypassword"), bcrypt.DefaultCost)
	res := db.Model(&models.User{}).Where("email = ?", "abc@def.com").Update("password_hash", string(hashedPassword))
	fmt.Printf("Updated %d records\n", res.RowsAffected)
}
