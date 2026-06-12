package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
	"github.com/shivam23singh24/core-api/internal/db"
	"github.com/shivam23singh24/core-api/internal/models"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	TOTPCode string `json:"totp_code"`
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	var existing models.User
	if err := db.DB.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		http.Error(w, "User already exists", http.StatusConflict)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	role := "user"
	if req.Email == "shivam23singh24@gmail.com" || req.Email == "shivam13singh07@gmail.com" || req.Email == "abc@def.com" {
		role = "admin"
	}

	user := models.User{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Name:         req.Name,
		Role:         role,
	}

	if err := db.DB.Create(&user).Error; err != nil {
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":    user.ID,
		"email": user.Email,
		"name":  user.Name,
		"role":  user.Role,
	})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	// 2FA Verification Step
	if user.TOTPEnabled {
		if req.TOTPCode == "" {
			http.Error(w, "2FA_REQUIRED", http.StatusForbidden)
			return
		}
		
		valid := totp.Validate(req.TOTPCode, user.TOTPSecret)
		if !valid {
			http.Error(w, "INVALID_2FA_CODE", http.StatusUnauthorized)
			return
		}
	}

	// Auto-upgrade admins if they were created before role was added
	if user.Role != "admin" && (req.Email == "shivam23singh24@gmail.com" || req.Email == "shivam13singh07@gmail.com" || req.Email == "abc@def.com") {
		user.Role = "admin"
		db.DB.Save(&user)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":    user.ID,
		"email": user.Email,
		"name":  user.Name,
		"role":  user.Role,
	})
}

func AdminUsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	
	userEmail := r.Header.Get("X-User-Email")
	if userEmail != "shivam23singh24@gmail.com" && userEmail != "shivam13singh07@gmail.com" && userEmail != "abc@def.com" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var users []models.User
	if err := db.DB.Find(&users).Error; err != nil {
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}

	var response []map[string]interface{}
	for _, u := range users {
		response = append(response, map[string]interface{}{
			"id": u.ID,
			"email": u.Email,
			"name": u.Name,
			"role": u.Role,
			"angel_client": u.AngelClient,
			"created_at": u.CreatedAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func AdminDeleteUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	if userEmail != "shivam23singh24@gmail.com" && userEmail != "shivam13singh07@gmail.com" && userEmail != "abc@def.com" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/admin/users/")
	if id == "" {
		http.Error(w, "Missing user ID", http.StatusBadRequest)
		return
	}

	// Delete user
	if err := db.DB.Delete(&models.User{}, id).Error; err != nil {
		http.Error(w, "Failed to delete user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

type AdminUpdateUserRequest struct {
	Role string `json:"role"`
	Name string `json:"name"`
}

func AdminUpdateUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPut && r.Method != http.MethodOptions {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	if userEmail != "shivam23singh24@gmail.com" && userEmail != "shivam13singh07@gmail.com" && userEmail != "abc@def.com" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/admin/users/")
	if id == "" {
		http.Error(w, "Missing user ID", http.StatusBadRequest)
		return
	}

	var req AdminUpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	var user models.User
	if err := db.DB.First(&user, id).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	user.Role = req.Role
	user.Name = req.Name
	db.DB.Save(&user)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

type UpdateProfileRequest struct {
	Name string `json:"name"`
}

func UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPut && r.Method != http.MethodOptions {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	if userEmail == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", userEmail).First(&user).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	user.Name = req.Name
	db.DB.Save(&user)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "profile_updated"})
}

type UpdateBinanceRequest struct {
	BinanceAPIKey string `json:"binance_api_key"`
	BinanceSecret string `json:"binance_secret"`
}

func UpdateBinanceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	if userEmail == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req UpdateBinanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", userEmail).First(&user).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	user.BinanceAPIKey = req.BinanceAPIKey
	user.BinanceSecret = req.BinanceSecret
	db.DB.Save(&user)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "binance_keys_updated"})
}

type UpdatePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func UpdatePasswordHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPut && r.Method != http.MethodOptions {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	if userEmail == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req UpdatePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", userEmail).First(&user).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		http.Error(w, "Incorrect current password", http.StatusUnauthorized)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash new password", http.StatusInternalServerError)
		return
	}

	user.PasswordHash = string(hashedPassword)
	db.DB.Save(&user)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "password_updated"})
}

func Generate2FAHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	if userEmail == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", userEmail).First(&user).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Portfolio Copilot",
		AccountName: user.Email,
	})
	if err != nil {
		http.Error(w, "Failed to generate TOTP", http.StatusInternalServerError)
		return
	}

	user.TOTPSecret = key.Secret()
	db.DB.Save(&user)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"url": key.URL(),
	})
}

type Verify2FARequest struct {
	Code string `json:"code"`
}

func Verify2FAHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	if userEmail == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req Verify2FARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", userEmail).First(&user).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if user.TOTPSecret == "" {
		http.Error(w, "2FA not initialized", http.StatusBadRequest)
		return
	}

	valid := totp.Validate(req.Code, user.TOTPSecret)
	if !valid {
		http.Error(w, "Invalid 2FA code", http.StatusUnauthorized)
		return
	}

	user.TOTPEnabled = true
	db.DB.Save(&user)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "totp_enabled"})
}
