const $ = (id) => document.getElementById(id);
let current = null; // 불러온 영상의 URL

fetch("/api/status").then((r) => r.json()).then((s) => {
  if (!s.ffmpeg) {
    $("warn").textContent = "ffmpeg가 설치되어 있지 않아 영상과 음성을 합칠 수 없습니다. README의 설치 방법을 확인하세요.";
    $("warn").hidden = false;
  }
});

function showError(msg) {
  $("error").textContent = msg;
  $("error").hidden = !msg;
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

function size(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

function duration(sec) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function detail(opt) {
  const lines = [];
  if (opt.video) {
    const v = opt.video;
    const parts = [`<b>${v.height}p${v.fps && v.fps > 30 ? Math.round(v.fps) : ""}</b>`, v.codec];
    if (v.hdr) parts.push("HDR");
    lines.push(parts.join(" · "));
  }
  if (opt.audio) {
    const a = opt.audio;
    const parts = [opt.video ? a.codec : `<b>${a.codec}</b>`];
    if (a.kbps) parts.push(`${a.kbps} kb/s`);
    if (!opt.video && a.khz) parts.push(`${a.khz} kHz`);
    lines.push(parts.join(" · "));
  }
  if (opt.size) lines.push(`약 ${size(opt.size)}`);
  return lines.join("<br>") || "사용 불가";
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = $("url").value.trim();
  showError("");
  $("load").disabled = true;
  $("load").textContent = "불러오는 중";
  try {
    const info = await post("/api/info", { url });
    current = url;
    $("thumb").src = info.thumbnail || "";
    $("thumb").hidden = !info.thumbnail;
    $("title").textContent = info.title;
    $("meta").textContent = [info.channel, duration(info.duration)].filter(Boolean).join(" · ");
    for (const [key, opt] of Object.entries(info.options)) {
      document.querySelector(`[data-detail="${key}"]`).innerHTML = detail(opt);
    }
    $("progress").hidden = true;
    $("download").disabled = false;
    $("result").hidden = false;
  } catch (err) {
    showError(err.message);
  } finally {
    $("load").disabled = false;
    $("load").textContent = "불러오기";
  }
});

$("download").addEventListener("click", async () => {
  const mode = document.querySelector("input[name=mode]:checked").value;
  showError("");
  $("download").disabled = true;
  $("save").hidden = true;
  $("progress").hidden = false;
  setProgress(null, "준비 중", "");
  try {
    const { job } = await post("/api/download", { url: current, mode });
    poll(job);
  } catch (err) {
    showError(err.message);
    $("download").disabled = false;
    $("progress").hidden = true;
  }
});

function setProgress(ratio, stage, numbers) {
  const bar = document.querySelector(".bar");
  bar.classList.toggle("busy", ratio === null);
  if (ratio !== null) $("bar-fill").style.width = `${Math.min(100, ratio * 100)}%`;
  $("stage").textContent = stage;
  $("numbers").textContent = numbers;
}

async function poll(job) {
  let p;
  try {
    p = await (await fetch(`/api/progress/${job}`)).json();
  } catch {
    return setTimeout(() => poll(job), 1000);
  }

  if (p.state === "error") {
    showError(p.error);
    $("progress").hidden = true;
    $("download").disabled = false;
    return;
  }

  if (p.state === "done") {
    setProgress(1, "완료", `${p.filename} · ${size(p.size)}`);
    const link = $("save");
    link.href = `/api/file/${job}`;
    link.hidden = false;
    link.click(); // 바로 저장 시작
    $("download").disabled = false;
    return;
  }

  if (p.state === "downloading" && p.total) {
    const stage = p.parts > 1 ? `${p.stage} (${p.part}/${p.parts})` : p.stage;
    const nums = [`${size(p.done)} / ${size(p.total)}`];
    if (p.speed) nums.push(`${size(p.speed)}/s`);
    if (p.eta != null) nums.push(`${duration(p.eta) || "0:00"} 남음`);
    setProgress(p.done / p.total, stage, nums.join(" · "));
  } else {
    setProgress(null, p.stage, "");
  }
  setTimeout(() => poll(job), 700);
}
