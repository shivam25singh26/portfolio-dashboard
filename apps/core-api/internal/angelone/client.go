package angelone

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"
)

const (
	BaseURL = "https://apiconnect.angelbroking.com"
)

// Client holds the HTTP client and authentication state for AngelOne
type Client struct {
	HTTPClient *http.Client
	APIKey     string
	ClientCode string
	Password   string
	TOTP       string
	JWTToken   string
	FeedToken  string
}

// NewClient initializes a new AngelOne client
func NewClient(apiKey, clientCode, password string) *Client {
	return &Client{
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
		APIKey:     apiKey,
		ClientCode: clientCode,
		Password:   password,
	}
}

// doRequest is a helper function to make HTTP requests with the correct headers
func (c *Client) doRequest(method, endpoint string, payload interface{}) ([]byte, error) {
	url := BaseURL + endpoint

	var reqBody []byte
	var err error
	if payload != nil {
		reqBody, err = json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal payload: %w", err)
		}
	}

	req, err := http.NewRequest(method, url, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-PrivateKey", c.APIKey)
	req.Header.Set("X-UserType", "USER")
	req.Header.Set("X-SourceID", "WEB")
	req.Header.Set("X-ClientLocalIP", "127.0.0.1")
	req.Header.Set("X-ClientPublicIP", "127.0.0.1")
	req.Header.Set("X-MACAddress", "00:00:00:00:00:00")

	if c.JWTToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.JWTToken)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error: status code %d, body: %s", resp.StatusCode, string(body))
	}

	return body, nil
}
