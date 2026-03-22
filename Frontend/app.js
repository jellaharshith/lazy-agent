const API_URL = "http://localhost:5001/api/intake";

const DEFAULT_LAT = 37.6688;
const DEFAULT_LNG = -122.0808;

const form = document.getElementById("intake-form");
const rawTextEl = document.getElementById("raw-text");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const outMessage = document.getElementById("out-message");
const outSummary = document.getElementById("out-summary");
const outClassification = document.getElementById("out-classification");
const outBestMatch = document.getElementById("out-best-match");

function setLoading(loading) {
  submitBtn.disabled = loading;
  rawTextEl.disabled = loading;
  if (loading) {
    statusEl.hidden = false;
    statusEl.textContent = "Loading…";
    statusEl.className = "status loading";
  }
}

function clearStatus() {
  statusEl.hidden = true;
  statusEl.textContent = "";
}

function showError(message) {
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = "status error";
}

function renderClassification(c) {
  outClassification.innerHTML = "";
  if (!c || typeof c !== "object") {
    outClassification.innerHTML = "<p class=\"muted\">No classification data.</p>";
    return;
  }
  const rows = [
    ["need_type", c.need_type],
    ["urgency", c.urgency],
    ["confidence", c.confidence],
    ["source", c.source],
  ];
  for (const [key, val] of rows) {
    if (val === undefined || val === null) continue;
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = typeof val === "number" && key === "confidence" ? String(val) : String(val);
    outClassification.append(dt, dd);
  }
}

function renderBestMatch(bestMatch) {
  outBestMatch.innerHTML = "";
  if (bestMatch == null) {
    const p = document.createElement("p");
    p.className = "muted fallback";
    p.textContent = "No nearby resource available right now.";
    outBestMatch.appendChild(p);
    return;
  }
  const dl = document.createElement("dl");
  dl.className = "kv";
  const entries = [
    ["title", bestMatch.title],
    ["type", bestMatch.type],
    ["quantity", bestMatch.quantity],
    ["distanceKm", bestMatch.distanceKm],
    ["expiresAt", bestMatch.expiresAt],
    ["source", bestMatch.source],
  ];
  for (const [key, val] of entries) {
    if (val === undefined || val === null) continue;
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = String(val);
    dl.append(dt, dd);
  }
  if (bestMatch.location && typeof bestMatch.location === "object") {
    const dt = document.createElement("dt");
    dt.textContent = "location";
    const dd = document.createElement("dd");
    const { lat, lng } = bestMatch.location;
    dd.textContent =
      lat != null && lng != null ? `${lat}, ${lng}` : JSON.stringify(bestMatch.location);
    dl.append(dt, dd);
  }
  outBestMatch.appendChild(dl);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw_text = rawTextEl.value.trim();
  if (!raw_text) return;

  setLoading(true);
  resultsEl.hidden = true;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_text,
        lat: DEFAULT_LAT,
        lng: DEFAULT_LNG,
      }),
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || text || `Request failed (${res.status})`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }

    outMessage.textContent = data.message ?? "—";
    outSummary.textContent = data.summary ?? "—";
    renderClassification(data.classification);
    renderBestMatch(data.bestMatch ?? null);

    resultsEl.hidden = false;
    clearStatus();
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    submitBtn.disabled = false;
    rawTextEl.disabled = false;
  }
});
