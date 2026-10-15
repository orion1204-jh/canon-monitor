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

**Actions** 탭 → Canon Product Monitor → **Run workflow**

## 실행 주기 개선

GitHub 무료 스케줄은 `*/5`로 설정해도 실제로는 몇 시간씩 지연됩니다.
더 자주 확인하려면 [cron-job.org](https://cron-job.org) 같은 외부 스케줄러가 주기적으로 아래 요청을 보내게 하세요.

> **간격 주의 (Actions 사용량):** 한 번 실행에 약 1분이 걸립니다.
> - 공개(public) 저장소: Actions 무제한 무료 → 5~10분 간격 가능
> - 비공개(private) 저장소: 월 2,000분 무료 → **1시간 간격** 정도가 한도 안. 한도를 넘기면 그 달은 실행이 멈춥니다.

- URL: `https://api.github.com/repos/<owner>/canon-monitor/actions/workflows/monitor.yml/dispatches`
- Method: `POST`
- Headers: `Authorization: Bearer <GitHub 토큰>`, `Accept: application/vnd.github+json`
- Body: `{"ref":"main"}`

토큰은 GitHub **Settings → Developer settings → Fine-grained tokens**에서 이 저장소만 선택하고 **Actions: Read and write** 권한으로 만듭니다.

## 로컬 실행

```bash
npm ci
npx playwright install chromium
# .env 파일에 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (없으면 콘솔에만 출력)
node src/index.js
```
