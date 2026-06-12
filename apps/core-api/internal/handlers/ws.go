package handlers

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/shivam23singh24/core-api/internal/models"
)

var (
	// Global channel for price ticks from AngelOne Scraper
	PriceBroadcast = make(chan models.PriceTick, 1000)

	// Thread-safe map of active WebSocket connections
	clients = make(map[*websocket.Conn]bool)
	clientsMutex sync.Mutex

	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for MVP
		},
	}
)

func init() {
	// Start the broadcaster goroutine
	go handleMessages()
}

// LivePricingWS upgrades HTTP to WebSocket and adds client to the pool
func LivePricingWS(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WS Upgrade Error:", err)
		return
	}

	clientsMutex.Lock()
	clients[ws] = true
	clientsMutex.Unlock()

	// Keep connection alive until client closes
	for {
		_, _, err := ws.ReadMessage()
		if err != nil {
			clientsMutex.Lock()
			delete(clients, ws)
			clientsMutex.Unlock()
			ws.Close()
			break
		}
	}
}

// handleMessages listens to the PriceBroadcast channel and sends to all connected clients
func handleMessages() {
	for {
		tick := <-PriceBroadcast

		clientsMutex.Lock()
		for client := range clients {
			err := client.WriteJSON(tick)
			if err != nil {
				log.Printf("WS Broadcast Error: %v", err)
				client.Close()
				delete(clients, client)
			}
		}
		clientsMutex.Unlock()
	}
}
