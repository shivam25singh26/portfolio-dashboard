const fetch = require('node-fetch');

async function testTrade() {
  // First, fetch the latest insights
  const res = await fetch('http://localhost:8080/api/insights');
  const insights = await res.json();
  
  const cryptoSignal = insights.find(i => i.exchange === 'BINANCE' || i.cap === 'Crypto');
  if (!cryptoSignal) {
    console.log("No Crypto Signal found to test!");
    return;
  }
  
  console.log("Found Crypto Signal:", cryptoSignal.symbol, "ID:", cryptoSignal.ID);

  // We need to execute the trade
  // Let's assume the user is 'alpha@gmail.com' or 'test@gmail.com'
  const userEmail = "alpha@gmail.com"; 
  
  console.log("Executing trade for User:", userEmail, "Signal ID:", cryptoSignal.ID);
  
  const execRes = await fetch('http://localhost:8080/api/paper/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Email': userEmail
    },
    body: JSON.stringify({ signal_id: cryptoSignal.ID, quantity: 100 })
  });
  
  const result = await execRes.text();
  console.log("Trade Execution Result:", result);
}

testTrade();
