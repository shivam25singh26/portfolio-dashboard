const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  await page.goto('https://round-assessments-buddy-applies.trycloudflare.com/login', { waitUntil: 'networkidle0' });
  
  await browser.close();
})();
