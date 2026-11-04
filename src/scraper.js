const { chromium } = require('playwright');

async function scrapeProducts() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('캐논 리퍼비시 샵 접속 중...');
    // networkidle은 광고·분석 요청 때문에 안 끝나는 경우가 있어, 상품 목록이 보이는지로 판단
    for (let attempt = 1; ; attempt++) {
      try {
        await page.goto('https://m.estore.kr.canon/planshop/refurmain', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('.product-item', { timeout: 30000 });
        break;
      } catch (error) {
        if (attempt >= 2) throw error;
        console.log(`접속 실패, 5초 후 재시도: ${error.message.split('\n')[0]}`);
        await page.waitForTimeout(5000);
      }
    }

    // "더보기" 버튼 클릭하여 모든 상품 로드
    let hasMore = true;
    let prevCount = 0;
    let sameCountRetries = 0;
    let clickCount = 0;

    while (hasMore && sameCountRetries < 3 && clickCount < 20) {
      const currentCount = await page.locator('.product-item').count();
      if (currentCount > 0 && currentCount === prevCount) {
        sameCountRetries++;
      } else {
        sameCountRetries = 0;
        prevCount = currentCount;
      }

      const moreBtn = page.locator('.more-btn');
      if (await moreBtn.isVisible()) {
        console.log(`더보기 클릭 중... (현재 상품 수: ${currentCount})`);
        await moreBtn.click();
        clickCount++;
        await page.waitForTimeout(2000); // 데이터 로딩을 위해 2초 대기
      } else {
        hasMore = false;
      }
    }

    // 상품 정보 추출
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

    console.log(`총 ${products.length}개의 상품을 찾았습니다.`);
    return products;

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
