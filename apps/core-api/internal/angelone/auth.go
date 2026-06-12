package angelone

import (
	"encoding/json"
	"fmt"
)

type LoginRequest struct {
	ClientCode string `json:"clientcode"`
	Password   string `json:"password"`
	TOTP       string `json:"totp"`
}

type LoginResponse struct {
	Status    bool   `json:"status"`
	Message   string `json:"message"`
	ErrorCode string `json:"errorcode"`
	Data      struct {
		JWTToken     string `json:"jwtToken"`
		RefreshToken string `json:"refreshToken"`
		FeedToken    string `json:"feedToken"`
	} `json:"data"`
}

// GenerateSession logs into AngelOne using the Client Code, Password, and TOTP
func (c *Client) GenerateSession(totp string) error {
	reqData := LoginRequest{
		ClientCode: c.ClientCode,
		Password:   c.Password,
		TOTP:       totp,
	}

	respBody, err := c.doRequest("POST", "/rest/auth/angelbroking/user/v1/loginByPassword", reqData)
	if err != nil {
		return fmt.Errorf("login request failed: %w", err)
	}

	var loginResp LoginResponse
	if err := json.Unmarshal(respBody, &loginResp); err != nil {
		return fmt.Errorf("failed to unmarshal login response: %w", err)
	}

	if !loginResp.Status {
		return fmt.Errorf("login failed: %s (ErrorCode: %s)", loginResp.Message, loginResp.ErrorCode)
	}

	c.JWTToken = loginResp.Data.JWTToken
	c.FeedToken = loginResp.Data.FeedToken
	c.TOTP = totp

	return nil
}
