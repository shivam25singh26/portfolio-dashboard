const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/callback/credentials',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.write(JSON.stringify({
  email: 'test2@test.com',
  password: 'mypassword',
  csrfToken: 'dummy' // NextAuth might reject without valid CSRF
}));
req.end();
