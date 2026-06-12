package models

import "time"

type UniverseEquity struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Ticker      string    `gorm:"uniqueIndex;not null" json:"ticker"`
	Company     string    `gorm:"not null" json:"company"`
	Region      string    `gorm:"index;not null" json:"region"`
	Sector      string    `gorm:"not null" json:"sector"`
	SubIndustry string    `json:"sub_industry"`
	Cap         string    `json:"cap"`
	Type        string    `json:"type"`
	Catalyst    string    `json:"catalyst"`
	Moat        string    `json:"moat"`
	Risk        string    `json:"risk"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}
