const { chromium } = require('playwright');

async function scrapeProducts() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('Connecting to Canon Refurbished Shop...');
    await page.goto('https://m.estore.kr.canon/planshop/refurmain', { waitUntil: 'networkidle' });

    // Uncheck "Exclude Sold Out" checkbox to see all products
    const filterLabel = page.locator('label.checkbox', { hasText: '품절제품 제외' });
    if (await filterLabel.isVisible()) {
      await filterLabel.click();
      await page.waitForTimeout(1000); // wait for filter application
    }

    // Click "More" button to load all products
    let hasMore = true;
    while (hasMore) {
      const moreBtn = page.locator('.more-btn');
      if (await moreBtn.isVisible()) {
          console.log('Clicking more...');
          await moreBtn.click();
          await page.waitForTimeout(1000);
      } else {
          hasMore = false;
      }
    }

    // Extract product info
    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('.product-item');
      return Array.from(items).map(item => {
        const name = item.querySelector('.product-title')?.innerText.trim();
        const price = item.querySelector('.price')?.innerText.trim();
        const isSoldOut = item.querySelector('.status-list .status')?.innerText.includes('일시품절') || false;
        const link = item.querySelector('.product-title a')?.href;
        
        return { name, price, isSoldOut, link };
      });
    });

    console.log(`Found ${products.length} products total.`);
    return products;

  } catch (error) {
    console.error('Error during scraping:', error);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeProducts };

if (require.main === module) {
  scrapeProducts().then(products => {
    console.log(JSON.stringify(products, null, 2));
  });
}
