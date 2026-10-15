# Canon Refurbished Monitor

캐논 리퍼비시 샵(https://m.estore.kr.canon/planshop/refurmain)을 주기적으로 확인해서
새 상품, 재입고, 가격 인하가 있으면 텔레그램으로 알려주는 봇입니다. 웹앱이 아니라 GitHub Actions에서 자동으로 실행됩니다.

## 동작 구조

1. GitHub Actions가 일정 주기로 `node src/index.js` 실행 (`.github/workflows/monitor.yml`)
2. `src/scraper.js`: Playwright(헤드리스 크롬)로 상품 목록 수집
3. `src/index.js`: `data/products.json`(지난번 목록)과 비교
4. `src/notifier.js`: 변경이 있으면 텔레그램 메시지 전송
5. 새 목록과 상태(`data/status.json`)를 저장소에 자동 커밋

알림 종류: 🆕 신규 상품 · 🔄 재입고 · 📉 가격 인하 · ⚠️ 3회 연속 실패 · ✅ 하루 한 번 정상 작동 신호

## 텔레그램 설정

1. 텔레그램에서 `@BotFather` → `/newbot`으로 봇을 만들고 **토큰**을 받습니다.
2. 만든 봇에게 아무 메시지나 보낸 뒤 `https://api.telegram.org/bot<토큰>/getUpdates`를 열어 `chat.id`를 확인합니다.
3. GitHub 저장소 **Settings → Secrets and variables → Actions → Secrets**에 등록합니다.
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`

## 키워드 필터 (선택)

**Settings → Secrets and variables → Actions → Variables**에 `WATCH_KEYWORDS`를 추가합니다.
예: `R6,RF,S등급` → 이름에 하나라도 포함된 상품만 알림. 비워 두면 전체 상품을 알립니다.

## 수동 실행

**Actions** 탭 → Canon Product Monitor → **Run workflow** (`loop_minutes`를 `0`으로 하면 한 번만 확인하고 끝남)

## 실행 주기

GitHub 스케줄은 설정보다 몇 시간씩 늦게 실행되는 경우가 많아서, 한 번 시작된 실행이 **약 5시간 40분 동안 5분마다** 반복 확인하도록 되어 있습니다.
매시간 스케줄이 다음 실행을 대기열에 올려 두므로, 이전 실행이 끝나면 다음 실행이 바로 이어집니다. 외부 스케줄러는 필요 없습니다.

- 간격/시간 변경: `monitor.yml`의 `INTERVAL_SECONDS`, `LOOP_MINUTES` 기본값 수정
- 수동 실행 시 `loop_minutes`를 `0`으로 하면 한 번만 확인
- 공개 저장소라 Actions 사용량은 무제한입니다. **비공개로 바꾸면 월 2,000분 한도를 며칠 만에 넘기니** 그때는 `LOOP_MINUTES`를 `0`으로 바꾸세요.

## 로컬 실행

```bash
npm ci
npx playwright install chromium
# .env 파일에 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (없으면 콘솔에만 출력)
node src/index.js
```
