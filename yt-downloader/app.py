"""YouTube 최고화질/최고음질 다운로더 (로컬 웹앱).

yt-dlp로 영상 정보를 읽고, 가장 좋은 영상 스트림과 음성 스트림을 받아
ffmpeg로 재인코딩 없이 합칩니다.
"""

import os
import re
import shutil
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

import yt_dlp
from flask import Flask, abort, jsonify, request, send_file

BASE_DIR = Path(__file__).resolve().parent
WORK_DIR = BASE_DIR / "downloads"
KEEP_SECONDS = 60 * 60  # 받은 파일은 1시간 뒤 정리

ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}

# 모드별 yt-dlp 포맷 지정
MODES = {
    # 가장 높은 해상도/프레임/HDR 영상 + 가장 좋은 음성, 원본 그대로 MKV에 담음
    "best": {"format": "bv*+ba/b", "merge": "mkv"},
    # 편집 프로그램 호환용: H.264 + AAC (YouTube 특성상 보통 최대 1080p)
    "mp4": {"format": "bv*[vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b", "merge": "mp4"},
    # 음성만: 가장 좋은 음성 스트림을 재인코딩 없이 추출
    "audio": {"format": "ba/b", "merge": None},
}

app = Flask(__name__, static_folder="static", static_url_path="")
jobs = {}
jobs_lock = threading.Lock()


def js_runtimes():
    """설치된 JS 런타임을 yt-dlp에 알려줌 (YouTube 서명 해독에 필요)."""
    found = {name: {} for name in ("deno", "node", "bun") if shutil.which(name)}
    return found or None


def base_opts():
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "noprogress": True,
    }
    runtimes = js_runtimes()
    if runtimes:
        opts["js_runtimes"] = runtimes
    browser = os.environ.get("COOKIES_BROWSER")  # 예: chrome, firefox, edge, safari
    if browser:
        opts["cookiesfrombrowser"] = (browser,)
    cookie_file = os.environ.get("COOKIES_FILE")
    if cookie_file:
        opts["cookiefile"] = cookie_file
    return opts


def check_url(url):
    try:
        host = urlparse(url).hostname or ""
    except ValueError:
        host = ""
    if host.lower() not in ALLOWED_HOSTS:
        abort(400, description="YouTube 링크만 지원합니다.")


def friendly_error(exc):
    msg = re.sub(r"\x1b\[[0-9;]*m", "", str(exc))
    rules = [
        ("confirm your age", "연령 제한 영상입니다. README의 쿠키 설정을 참고하세요."),
        ("Sign in to confirm", "YouTube가 로그인을 요구합니다. README의 쿠키 설정을 참고하세요."),
        ("Private video", "비공개 영상입니다."),
        ("members-only", "채널 멤버십 전용 영상입니다."),
        ("Video unavailable", "영상을 찾을 수 없거나 재생할 수 없습니다."),
        ("ffmpeg", "ffmpeg가 설치되어 있지 않습니다. README를 참고해 설치하세요."),
        ("is not a valid URL", "올바른 링크가 아닙니다."),
    ]
    for key, text in rules:
        if key.lower() in msg.lower():
            return text
    return msg.replace("ERROR: ", "")[:300]


def describe(fmts):
    """선택된 포맷 목록을 화면에 보여줄 요약으로 변환."""
    fmts = [x for f in fmts for x in (f.get("requested_formats") or [f])]
    video = next((f for f in fmts if f.get("vcodec") not in (None, "none")), None)
    audio = next((f for f in fmts if f.get("acodec") not in (None, "none")), None)
    size = 0
    for f in fmts:
        size += f.get("filesize") or f.get("filesize_approx") or 0
    out = {"size": size or None, "video": None, "audio": None}
    if video:
        out["video"] = {
            "height": video.get("height"),
            "width": video.get("width"),
            "fps": video.get("fps"),
            "codec": codec_name(video.get("vcodec")),
            "hdr": (video.get("dynamic_range") or "SDR") != "SDR",
            "kbps": round(video["vbr"]) if video.get("vbr") else None,
        }
    if audio:
        out["audio"] = {
            "codec": codec_name(audio.get("acodec")),
            "kbps": round(audio["abr"]) if audio.get("abr") else None,
            "khz": round(audio["asr"] / 1000, 1) if audio.get("asr") else None,
            "channels": audio.get("audio_channels"),
        }
    return out


def codec_name(codec):
    if not codec:
        return None
    c = codec.lower()
    for prefix, name in (("av01", "AV1"), ("vp09", "VP9"), ("vp9", "VP9"), ("avc1", "H.264"),
                         ("hev1", "H.265"), ("hvc1", "H.265"), ("opus", "Opus"),
                         ("mp4a", "AAC"), ("ec-3", "E-AC-3"), ("ac-3", "AC-3")):
        if c.startswith(prefix):
            return name
    return codec


@app.get("/")
def index():
    return app.send_static_file("index.html")


@app.get("/api/status")
def status():
    return jsonify({"ffmpeg": bool(shutil.which("ffmpeg")), "ytdlp": yt_dlp.version.__version__})


@app.post("/api/info")
def info():
    url = (request.json or {}).get("url", "").strip()
    check_url(url)
    try:
        with yt_dlp.YoutubeDL(base_opts()) as ydl:
            data = ydl.extract_info(url, download=False)
            formats = data.get("formats") or []
            options = {}
            for key, mode in MODES.items():
                selector = ydl.build_format_selector(mode["format"])
                options[key] = describe(ydl._select_formats(formats, selector))
    except yt_dlp.utils.DownloadError as e:
        return jsonify({"error": friendly_error(e)}), 422

    return jsonify({
        "id": data.get("id"),
        "title": data.get("title"),
        "channel": data.get("channel") or data.get("uploader"),
        "duration": data.get("duration"),
        "thumbnail": data.get("thumbnail"),
        "is_live": data.get("is_live"),
        "options": options,
    })


@app.post("/api/download")
def start_download():
    body = request.json or {}
    url = body.get("url", "").strip()
    mode = body.get("mode", "best")
    check_url(url)
    if mode not in MODES:
        abort(400, description="알 수 없는 모드입니다.")

    cleanup()
    job_id = uuid.uuid4().hex
    with jobs_lock:
        jobs[job_id] = {"state": "starting", "stage": "준비 중", "done": 0, "total": 0,
                        "speed": None, "eta": None, "file": None, "error": None,
                        "created": time.time()}
    threading.Thread(target=run_job, args=(job_id, url, mode), daemon=True).start()
    return jsonify({"job": job_id})


def run_job(job_id, url, mode):
    job = jobs[job_id]
    out_dir = WORK_DIR / job_id
    out_dir.mkdir(parents=True, exist_ok=True)
    spec = MODES[mode]
    stream_no = {"n": 0}
    stream_total = 2 if "+" in spec["format"] else 1

    def on_progress(d):
        if d["status"] == "downloading":
            fmt = d.get("info_dict", {})
            is_video = fmt.get("vcodec") not in (None, "none")
            job.update(
                state="downloading",
                stage=("영상 받는 중" if is_video else "음성 받는 중"),
                done=d.get("downloaded_bytes") or 0,
                total=d.get("total_bytes") or d.get("total_bytes_estimate") or 0,
                speed=d.get("speed"),
                eta=d.get("eta"),
                part=min(stream_no["n"] + 1, stream_total),
                parts=stream_total,
            )
        elif d["status"] == "finished":
            stream_no["n"] += 1

    def on_post(d):
        if d["status"] == "started":
            names = {"Merger": "영상과 음성 합치는 중", "ExtractAudio": "음성 추출 중",
                     "Metadata": "정보 기록 중"}
            job.update(state="processing", stage=names.get(d.get("postprocessor"), "마무리 중"))

    opts = base_opts()
    opts.update({
        "format": spec["format"],
        "outtmpl": str(out_dir / "%(title).150B [%(id)s].%(ext)s"),
        "progress_hooks": [on_progress],
        "postprocessor_hooks": [on_post],
        "windowsfilenames": True,
        "postprocessors": [],
    })
    if spec["merge"]:
        opts["merge_output_format"] = spec["merge"]
    if mode == "audio":
        opts["postprocessors"].append({"key": "FFmpegExtractAudio", "preferredcodec": "best"})
    opts["postprocessors"].append({"key": "FFmpegMetadata", "add_metadata": True})

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            result = ydl.extract_info(url, download=True)
        path = None
        for item in result.get("requested_downloads") or []:
            if item.get("filepath"):
                path = Path(item["filepath"])
        if not path or not path.exists():
            files = [p for p in out_dir.iterdir() if p.is_file() and not p.name.endswith(".part")]
            path = max(files, key=lambda p: p.stat().st_size) if files else None
        if not path:
            raise RuntimeError("완성된 파일을 찾지 못했습니다.")
        job.update(state="done", stage="완료", file=str(path), size=path.stat().st_size)
    except Exception as e:  # noqa: BLE001 - 사용자에게 그대로 보여줌
        job.update(state="error", error=friendly_error(e))


@app.get("/api/progress/<job_id>")
def progress(job_id):
    job = jobs.get(job_id)
    if not job:
        abort(404)
    data = {k: v for k, v in job.items() if k != "file"}
    data["filename"] = Path(job["file"]).name if job.get("file") else None
    return jsonify(data)


@app.get("/api/file/<job_id>")
def get_file(job_id):
    job = jobs.get(job_id)
    if not job or not job.get("file"):
        abort(404)
    path = Path(job["file"])
    return send_file(path, as_attachment=True, download_name=path.name)


def cleanup():
    """오래된 작업 폴더 삭제."""
    now = time.time()
    with jobs_lock:
        for jid in [j for j, v in jobs.items() if now - v["created"] > KEEP_SECONDS]:
            jobs.pop(jid, None)
    if WORK_DIR.exists():
        for d in WORK_DIR.iterdir():
            if d.is_dir() and now - d.stat().st_mtime > KEEP_SECONDS and d.name not in jobs:
                shutil.rmtree(d, ignore_errors=True)


@app.errorhandler(400)
@app.errorhandler(404)
def handle_error(e):
    return jsonify({"error": e.description}), e.code


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    if not shutil.which("ffmpeg"):
        print("경고: ffmpeg를 찾을 수 없습니다. 영상과 음성을 합치려면 ffmpeg가 필요합니다.")
    print(f"브라우저에서 http://127.0.0.1:{port} 을 여세요.")
    app.run(host="127.0.0.1", port=port, threaded=True)
