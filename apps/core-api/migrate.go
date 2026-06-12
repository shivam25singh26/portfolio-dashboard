package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/shivam23singh24/core-api/internal/db"
)

func main() {
	godotenv.Load()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is empty")
	}
	db.ConnectDatabase(dsn)
	log.Println("Migration successful!")
}
