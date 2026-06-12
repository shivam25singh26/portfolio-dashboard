const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Emulate iPhone 13
  await page.emulate(puppeteer.KnownDevices['iPhone 13']);
  
  page.on('console', msg => console.log('LOG:', msg.text()));

  await page.goto('https://round-assessments-buddy-applies.trycloudflare.com', { waitUntil: 'networkidle0' });
  
  // Wait for login redirect if any
  await new Promise(r => setTimeout(r, 2000));
  const url = page.url();
  console.log("Current URL:", url);
  
  if (url.includes('/login')) {
    console.log("Logging in...");
    await page.type('input[type="email"]', 'abc@def.com');
    await page.type('input[type="password"]', 'mypassword');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  const issues = await page.evaluate(() => {
    const problems = [];
    const width = document.documentElement.clientWidth;
    
    // Check for horizontal overflow
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > width + 1 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
        problems.push(`Overflow: <${el.tagName} class="${el.className}"> extends to ${rect.right}px (viewport is ${width}px)`);
      }
    });
    
    // Check for squished or tiny text
    document.querySelectorAll('span, p, a, button, div, h1, h2, h3').forEach(el => {
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      if (fontSize < 10 && el.textContent.trim().length > 0) {
        problems.push(`Tiny text (${fontSize}px): <${el.tagName} class="${el.className}"> "${el.textContent.substring(0, 15)}..."`);
      }
    });

    return problems;
  });
  
  console.log(`Found ${issues.length} potential mobile UI issues.`);
  issues.slice(0, 20).forEach(i => console.log(i));
  
  await page.screenshot({ path: 'mobile_screenshot.png' });
  await browser.close();
})();
