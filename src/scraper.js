const { chromium } = require('playwright');

async function scrapeProducts() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('캐논 리퍼비시 샵 접속 중...');
    await page.goto('https://m.estore.kr.canon/planshop/refurmain', { waitUntil: 'networkidle' });

    // "품절제품 제외" 체크박스 해제 (전체 상품 확인을 위해)
    const filterLabel = page.locator('label.checkbox', { hasText: '품절제품 제외' });
    if (await filterLabel.isVisible()) {
      await filterLabel.click();
      await page.waitForTimeout(1000); // 필터 적용 대기
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

  } catch (error) {
    console.error('스크래핑 중 오류 발생:', error);
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
