const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://192.168.0.251:3000/login');
  
  await page.type('input[type="email"]', 'abc@def.com');
  await page.type('input[type="password"]', 'mypassword');
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  const url = page.url();
  console.log('Final URL:', url);
  await browser.close();
})();
