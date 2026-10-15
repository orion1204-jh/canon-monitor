const fs = require('fs');
const path = require('path');
const { scrapeProducts } = require('./scraper');
const { sendNotification } = require('./notifier');

const DATA_PATH = path.join(__dirname, '../data/products.json');
const STATUS_PATH = path.join(__dirname, '../data/status.json');
const FAILURE_ALERT_THRESHOLD = 3; // 연속 실패 N회째에 한 번만 알림

// 예: "R6,RF,S등급" — 비어 있으면 모든 상품 알림
const WATCH_KEYWORDS = (process.env.WATCH_KEYWORDS || '')
  .split(',')
  .map(k => k.trim().toLowerCase())
  .filter(Boolean);
const matchesKeywords = p =>
  WATCH_KEYWORDS.length === 0 || WATCH_KEYWORDS.some(k => p.name.toLowerCase().includes(k));

const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 상품 상세 ID가 있는 링크가 이름보다 안정적인 키.
// 사이트가 ID 없는 링크(".../detailview/")를 주는 상품도 있어서, 그때는 이름으로 대체
const SHOP_URL = 'https://m.estore.kr.canon/planshop/refurmain';
const hasProductId = p => /\/\d+$/.test(p.link || '');
const keyOf = p => (hasProductId(p) ? p.link : p.name);
const priceNum = p => Number(String(p.price ?? '').replace(/[^0-9]/g, '')) || null;

function formatItem(item, extra = '') {
  let msg = `🛒 <b>${escapeHtml(item.name)}</b>\n`;
  msg += `💰 Price: ${escapeHtml(item.price)}KRW${extra}\n`;
  const link = hasProductId(item) ? item.link : SHOP_URL;
  msg += `🔗 <a href="${escapeHtml(link)}">View Product</a>\n`;
  return msg + '\n';
}

async function recordFailure(reason) {
  const status = readJson(STATUS_PATH, {});
  const failures = (status.consecutiveFailures || 0) + 1;
  writeJson(STATUS_PATH, { ...status, consecutiveFailures: failures, lastError: reason });
  console.error(`Monitoring failed (${failures} in a row): ${reason}`);
  if (failures === FAILURE_ALERT_THRESHOLD) {
    await sendNotification(
      `<b>[Canon Monitor ⚠️]</b>\n${failures}회 연속 실패했습니다.\n사유: ${escapeHtml(reason)}`
    );
  }
  process.exitCode = 1;
}

async function main() {
  console.log('Monitoring started:', new Date().toLocaleString());

  // 1. Scrape current products
  let currentProducts;
  try {
    currentProducts = await scrapeProducts();
  } catch (error) {
    return recordFailure(`스크래핑 오류: ${error.message}`);
  }
  currentProducts = currentProducts.filter(p => p.name);

  if (currentProducts.length === 0) {
    return recordFailure('상품을 하나도 찾지 못했습니다 (사이트 구조 변경 또는 접속 차단 가능성)');
  }

  // 2. Load saved products
  const savedProducts = readJson(DATA_PATH, []);
  const savedByKey = new Map(savedProducts.map(p => [keyOf(p), p]));

  // 3. Compare: 신규 / 재입고 / 가격 인하
  const newItems = [];
  const restocked = [];
  const priceDrops = [];
  for (const item of currentProducts) {
    if (item.isSoldOut || !matchesKeywords(item)) continue;
    const prev = savedByKey.get(keyOf(item));
    if (!prev) {
      newItems.push(item);
    } else if (prev.isSoldOut) {
      restocked.push(item);
    } else if (priceNum(prev) && priceNum(item) && priceNum(item) < priceNum(prev)) {
      priceDrops.push({ item, prev });
    }
  }

  let notified = true;
  if (newItems.length + restocked.length + priceDrops.length > 0) {
    console.log(`new: ${newItems.length}, restocked: ${restocked.length}, price drops: ${priceDrops.length}`);
    let message = `<b>[Canon Refurbished Alert]</b>\n\n`;
    if (newItems.length) {
      message += `<b>🆕 신규 상품</b>\n`;
      newItems.forEach(item => { message += formatItem(item); });
    }
    if (restocked.length) {
      message += `<b>🔄 재입고</b>\n`;
      restocked.forEach(item => { message += formatItem(item); });
    }
    if (priceDrops.length) {
      message += `<b>📉 가격 인하</b>\n`;
      priceDrops.forEach(({ item, prev }) => {
        message += formatItem(item, ` (이전 ${escapeHtml(prev.price)}KRW)`);
      });
    }
    notified = await sendNotification(message);
  } else {
    console.log('No new items.');
  }

  // 4. Update state — 알림 전송에 실패했다면 다음 실행에서 다시 알리도록 상태를 유지
  if (!notified) {
    return recordFailure('텔레그램 알림 전송 실패');
  }
  writeJson(DATA_PATH, currentProducts);

  // 5. 하루 한 번(KST 기준) 정상 작동 알림
  const status = readJson(STATUS_PATH, {});
  let lastHeartbeat = status.lastHeartbeat;
  if (lastHeartbeat !== todayKst()) {
    const available = currentProducts.filter(p => !p.isSoldOut).length;
    const sent = await sendNotification(
      `✅ Canon Monitor 정상 작동 중\n상품 ${currentProducts.length}개 · 판매중 ${available}개`
    );
    if (sent) lastHeartbeat = todayKst();
  }
  writeJson(STATUS_PATH, { consecutiveFailures: 0, lastHeartbeat });
  console.log('State updated.');
}

main().catch(error => recordFailure(`예상치 못한 오류: ${error.message}`));
