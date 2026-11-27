# YouTube 다운로더

YouTube 영상을 **최고 화질 + 최고 음질**로 받는 로컬 웹앱입니다.
[yt-dlp](https://github.com/yt-dlp/yt-dlp)로 가장 좋은 영상 스트림과 음성 스트림을 고른 뒤,
ffmpeg로 **재인코딩 없이** 하나로 합칩니다. 화질 손실이 없습니다.

내 컴퓨터에서 실행하고 브라우저로 `http://127.0.0.1:8000`에 접속해서 씁니다.

## 받을 수 있는 형식

| 모드 | 내용 | 용도 |
| --- | --- | --- |
| 최고 화질 (MKV) | 가장 높은 해상도·프레임·HDR 영상(보통 AV1/VP9) + 가장 좋은 음성(보통 Opus) | 보관, 감상 (VLC, IINA, mpv 등) |
| 호환 MP4 | H.264 + AAC | 다빈치 리졸브, 프리미어, 아이폰 등. YouTube가 H.264를 보통 1080p까지만 제공 |
| 음성만 | 가장 좋은 음성 스트림 그대로 (보통 Opus `.opus`, 없으면 AAC `.m4a`) | 음악, 팟캐스트 |

> 4K/8K, HDR, 60fps 영상은 YouTube가 AV1이나 VP9로만 제공합니다. 편집 프로그램에서 열리지 않으면
> "최고 화질"로 받은 뒤 직접 변환하거나 "호환 MP4"를 쓰세요.

## 설치

필요한 것: **Python 3.10 이상**, **ffmpeg**, (권장) **Deno** 또는 **Node.js**

YouTube는 영상 주소를 JavaScript로 암호화해서, yt-dlp가 이를 풀려면 JS 런타임이 필요합니다.
설치되어 있는 Deno/Node/Bun을 앱이 자동으로 찾아 씁니다.

### macOS

```bash
brew install python ffmpeg deno
cd yt-downloader
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Windows

```powershell
winget install Python.Python.3.12 Gyan.FFmpeg DenoLand.Deno
cd yt-downloader
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

실행 후 브라우저에서 **http://127.0.0.1:8000** 을 엽니다.

## 사용법

1. YouTube 링크를 붙여 넣고 **불러오기**
2. 모드별로 받게 될 해상도·코덱·음질·예상 용량이 표시됩니다
3. 모드를 고르고 **다운로드** → 끝나면 브라우저가 파일을 자동으로 저장합니다

받은 파일은 `downloads/` 폴더에 임시로 남았다가 1시간 뒤 자동으로 지워집니다.

## 문제 해결

**"YouTube가 로그인을 요구합니다" / 연령 제한 영상**
브라우저에 로그인된 YouTube 쿠키를 쓰도록 실행합니다.

```bash
COOKIES_BROWSER=chrome python app.py      # macOS / Linux (firefox, edge, safari도 가능)
set COOKIES_BROWSER=firefox && python app.py   # Windows
```

Windows의 Chrome/Edge는 실행 중이면 쿠키를 읽지 못할 수 있습니다. 이때는 Firefox를 쓰거나,
쿠키를 `cookies.txt`로 내보낸 뒤 `COOKIES_FILE=cookies.txt`로 지정하세요.
YouTube Premium 전용 고비트레이트 1080p도 Premium 계정 쿠키가 있어야 받을 수 있습니다.

**갑자기 다운로드가 안 될 때**
YouTube가 자주 바뀌므로 yt-dlp를 업데이트하면 대부분 해결됩니다.

```bash
pip install -U "yt-dlp[default]"
```

**다른 포트로 실행**: `PORT=9000 python app.py`

## 주의

본인이 권리를 가진 영상이나 다운로드가 허락된 영상에만 사용하세요.
YouTube 이용약관은 YouTube가 제공하는 기능 외의 다운로드를 제한합니다.
