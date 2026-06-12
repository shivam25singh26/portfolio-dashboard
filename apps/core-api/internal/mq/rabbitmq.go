package mq

import (
	"context"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

var (
	Conn *amqp.Connection
	Ch   *amqp.Channel
)

func ConnectRabbitMQ(amqpURL string) {
	var err error
	Conn, err = amqp.Dial(amqpURL)
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}

	Ch, err = Conn.Channel()
	if err != nil {
		log.Fatalf("Failed to open a channel: %v", err)
	}

	// Declare the queues we will use
	_, err = Ch.QueueDeclare("market_scans", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to declare queue market_scans: %v", err)
	}

	_, err = Ch.QueueDeclare("trade_proposals", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to declare queue trade_proposals: %v", err)
	}

	_, err = Ch.QueueDeclare("telegram_broadcast", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to declare queue telegram_broadcast: %v", err)
	}

	_, err = Ch.QueueDeclare("order_requests", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to declare queue order_requests: %v", err)
	}

	log.Println("RabbitMQ connected and queues declared.")
}

func PublishMessage(queueName string, body string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := Ch.PublishWithContext(ctx,
		"",        // exchange
		queueName, // routing key
		false,     // mandatory
		false,     // immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        []byte(body),
		})
	return err
}
