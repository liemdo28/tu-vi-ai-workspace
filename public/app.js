const STORAGE_KEY = "tuvi_workspace_v2";

const state = loadState();

const ui = {
  profileList: document.getElementById("profile-list"),
  currentName: document.getElementById("current-name"),
  status: document.getElementById("status"),
  form: document.getElementById("profile-form"),
  qaForm: document.getElementById("qa-form"),
  qaHistory: document.getElementById("qa-history"),
  calendarList: document.getElementById("calendar-list"),
  newProfileBtn: document.getElementById("new-profile-btn"),
  deleteBtn: document.getElementById("delete-btn"),
  saveBtn: document.getElementById("save-btn"),
  genCalendarBtn: document.getElementById("gen-calendar-btn"),
  tabButtons: Array.from(document.querySelectorAll(".tab-btn")),
  tabPanels: {
    analysis: document.getElementById("tab-analysis"),
    qa: document.getElementById("tab-qa"),
    calendar: document.getElementById("tab-calendar")
  },
  fields: {
    name: document.getElementById("name"),
    gender: document.getElementById("gender"),
    birthDate: document.getElementById("birth-date"),
    birthChi: document.getElementById("birth-chi"),
    birthPlace: document.getElementById("birth-place"),
    timezone: document.getElementById("timezone")
  },
  analysis: {
    solar: document.getElementById("solar-line"),
    lunar: document.getElementById("lunar-line"),
    weekday: document.getElementById("weekday-line"),
    pillars: document.getElementById("pillar-list"),
    elements: document.getElementById("element-list"),
    hoangDao: document.getElementById("hoang-dao-line"),
    tuviOverview: document.getElementById("tuvi-overview"),
    tuviRecommend: document.getElementById("tuvi-recommend")
  },
  auth: {
    display: document.getElementById("auth-display"),
    email: document.getElementById("auth-email"),
    password: document.getElementById("auth-password"),
    registerBtn: document.getElementById("register-btn"),
    loginBtn: document.getElementById("login-btn"),
    logoutBtn: document.getElementById("logout-btn"),
    status: document.getElementById("auth-status"),
    mode: document.getElementById("sync-mode"),
    syncBtn: document.getElementById("sync-now-btn")
  }
};

bindEvents();
init();

async function init() {
  render();
  if (state.session.token) {
    try {
      const me = await authMe();
      state.session.user = me.user;
      state.session.mode = "cloud";
      await loadProfilesFromCloud();
      setAuthStatus(`Đăng nhập: ${me.user.email}`, false);
    } catch {
      state.session = { token: "", user: null, mode: "local" };
      setAuthStatus("Phiên cloud hết hạn. Đang dùng local.", true);
    }
    persist();
    render();
  }
}

function bindEvents() {
  ui.newProfileBtn.addEventListener("click", onNewProfile);
  ui.saveBtn.addEventListener("click", onSaveProfile);
  ui.deleteBtn.addEventListener("click", onDeleteProfile);
  ui.form.addEventListener("submit", onAnalyzeProfile);
  ui.qaForm.addEventListener("submit", onAskQuestion);
  ui.genCalendarBtn.addEventListener("click", onGenerateCalendar);

  for (const btn of ui.tabButtons) {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  }

  ui.auth.registerBtn.addEventListener("click", onRegister);
  ui.auth.loginBtn.addEventListener("click", onLogin);
  ui.auth.logoutBtn.addEventListener("click", onLogout);
  ui.auth.syncBtn.addEventListener("click", onSyncNow);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.profiles) || parsed.profiles.length === 0) return seedState();
    return {
      profiles: parsed.profiles.map(normalizeProfileRecord),
      selectedId: parsed.selectedId || parsed.profiles[0].id,
      activeTab: parsed.activeTab || "analysis",
      session: {
        token: parsed.session?.token || "",
        user: parsed.session?.user || null,
        mode: parsed.session?.mode || "local"
      }
    };
  } catch {
    return seedState();
  }
}

function seedState() {
  const sample = {
    id: uid(),
    name: "Nguyễn Văn A",
    gender: "Nam",
    birth_date: "1990-01-01",
    birth_chi: "Tuất",
    birth_place: "TP.HCM",
    timezone: "Asia/Ho_Chi_Minh",
    analysis: null,
    qa: [],
    calendar: []
  };
  return {
    profiles: [sample],
    selectedId: sample.id,
    activeTab: "analysis",
    session: {
      token: "",
      user: null,
      mode: "local"
    }
  };
}

function normalizeProfileRecord(p) {
  return {
    id: p.id || uid(),
    name: clean(p.name || "Người dùng"),
    gender: clean(p.gender || "Không rõ"),
    birth_date: clean(p.birth_date || ""),
    birth_chi: clean(p.birth_chi || "Ngọ"),
    birth_place: clean(p.birth_place || ""),
    timezone: clean(p.timezone || "Asia/Ho_Chi_Minh"),
    analysis: p.analysis && typeof p.analysis === "object" ? p.analysis : null,
    qa: Array.isArray(p.qa) ? p.qa : [],
    calendar: Array.isArray(p.calendar) ? p.calendar : []
  };
}

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      profiles: state.profiles,
      selectedId: state.selectedId,
      activeTab: state.activeTab,
      session: state.session
    })
  );
}

function selectedProfile() {
  return state.profiles.find((p) => p.id === state.selectedId) || null;
}

function switchTab(tab) {
  if (!ui.tabPanels[tab]) return;
  state.activeTab = tab;
  for (const btn of ui.tabButtons) btn.classList.toggle("active", btn.dataset.tab === tab);
  for (const [key, panel] of Object.entries(ui.tabPanels)) panel.classList.toggle("active", key === tab);
  persist();
}

function render() {
  const profile = selectedProfile();
  renderAuth();
  renderProfileList();
  renderForm(profile);
  renderAnalysis(profile);
  renderQA(profile);
  renderCalendar(profile);
  ui.currentName.textContent = profile ? profile.name : "Chưa chọn";
  switchTab(state.activeTab || "analysis");
}

function renderAuth() {
  const cloud = state.session.mode === "cloud" && state.session.user;
  ui.auth.mode.textContent = cloud ? "Cloud" : "Local";
  if (cloud) {
    ui.auth.status.textContent = `Đã đăng nhập: ${state.session.user.email}`;
  } else if (!ui.auth.status.textContent) {
    ui.auth.status.textContent = "Chưa đăng nhập. Dữ liệu đang lưu trên trình duyệt này.";
  }
}

function renderProfileList() {
  ui.profileList.innerHTML = state.profiles
    .map(
      (p) =>
        `<li><button data-id="${esc(p.id)}" class="${p.id === state.selectedId ? "active" : ""}" type="button">${esc(
          p.name
        )}</button></li>`
    )
    .join("");

  for (const btn of ui.profileList.querySelectorAll("button[data-id]")) {
    btn.addEventListener("click", () => {
      state.selectedId = btn.dataset.id;
      render();
      persist();
    });
  }
}

function renderForm(profile) {
  if (!profile) return;
  ui.fields.name.value = profile.name || "";
  ui.fields.gender.value = profile.gender || "Nam";
  ui.fields.birthDate.value = profile.birth_date || "";
  ui.fields.birthChi.value = profile.birth_chi || "Ngọ";
  ui.fields.birthPlace.value = profile.birth_place || "";
  ui.fields.timezone.value = profile.timezone || "Asia/Ho_Chi_Minh";
}

function renderAnalysis(profile) {
  const analysis = profile?.analysis || null;
  if (!analysis) {
    ui.analysis.solar.textContent = "-";
    ui.analysis.lunar.textContent = "-";
    ui.analysis.weekday.textContent = "-";
    ui.analysis.pillars.innerHTML = "<li>-</li>";
    ui.analysis.elements.innerHTML = "<li>-</li>";
    ui.analysis.hoangDao.textContent = "-";
    ui.analysis.tuviOverview.textContent = "-";
    ui.analysis.tuviRecommend.innerHTML = "<li>-</li>";
    return;
  }

  ui.analysis.solar.textContent = `Dương lịch: ${analysis.solar?.date || "-"} | Giờ sinh: ${
    analysis.profile?.birth_chi || "-"
  }`;
  ui.analysis.lunar.textContent = `Âm lịch: ${analysis.lunar?.date_text || "-"}`;
  ui.analysis.weekday.textContent = `Thứ: ${analysis.solar?.weekday || "-"}`;

  ui.analysis.pillars.innerHTML = [
    `Năm: ${analysis.bazi?.year_pillar || "-"}`,
    `Tháng: ${analysis.bazi?.month_pillar || "-"}`,
    `Ngày: ${analysis.bazi?.day_pillar || "-"}`,
    `Giờ: ${analysis.bazi?.hour_pillar || "-"}`,
    `Nhật chủ: ${analysis.bazi?.day_master || "-"} (${analysis.bazi?.day_master_element || "-"})`
  ]
    .map((row) => `<li>${esc(row)}</li>`)
    .join("");

  const counts = analysis.elements?.counts || {};
  ui.analysis.elements.innerHTML = [
    `Mộc: ${counts["Mộc"] ?? 0}`,
    `Hỏa: ${counts["Hỏa"] ?? 0}`,
    `Thổ: ${counts["Thổ"] ?? 0}`,
    `Kim: ${counts["Kim"] ?? 0}`,
    `Thủy: ${counts["Thủy"] ?? 0}`,
    `Mạnh: ${(analysis.elements?.dominant || []).join(", ") || "-"}`,
    `Yếu: ${(analysis.elements?.weakest || []).join(", ") || "-"}`
  ]
    .map((row) => `<li>${esc(row)}</li>`)
    .join("");

  const hoang = Array.isArray(analysis.hoang_dao_hours) ? analysis.hoang_dao_hours : [];
  ui.analysis.hoangDao.textContent = hoang.length
    ? hoang.map((h) => `${h.chi} (${h.range})`).join(", ")
    : "-";

  ui.analysis.tuviOverview.textContent = analysis.tu_vi?.overview || "-";
  const rec = Array.isArray(analysis.tu_vi?.recommendations) ? analysis.tu_vi.recommendations : [];
  ui.analysis.tuviRecommend.innerHTML = rec.length ? rec.map((r) => `<li>${esc(r)}</li>`).join("") : "<li>-</li>";
}

function renderQA(profile) {
  const qa = Array.isArray(profile?.qa) ? profile.qa : [];
  if (!qa.length) {
    ui.qaHistory.innerHTML = '<div class="qa-item"><p>Chưa có câu hỏi.</p></div>';
    return;
  }

  ui.qaHistory.innerHTML = qa
    .slice()
    .reverse()
    .map((item) => renderQAItem(item))
    .join("");
}

function renderQAItem(item) {
  const report = item.report || {};
  const metricRows = Array.isArray(report.metric_table)
    ? report.metric_table
        .map(
          (m) =>
            `<tr><td>${esc(m.metric || "-")}</td><td>${esc(m.value || "-")}</td><td>${esc(
              m.meaning || "-"
            )}</td></tr>`
        )
        .join("")
    : "";

  const detailRows = Array.isArray(report.detailed_analysis)
    ? report.detailed_analysis
        .map((d) => `<article><h5>${esc(d.title || "-")}</h5><p>${formatMultiline(d.content || "")}</p></article>`)
        .join("")
    : "";

  const planRows = Array.isArray(report.action_plan)
    ? report.action_plan
        .map(
          (p) =>
            `<tr><td>${esc(p.priority || "-")}</td><td>${esc(p.action || "-")}</td><td>${esc(
              p.timeline || "-"
            )}</td><td>${esc(p.reason || "-")}</td></tr>`
        )
        .join("")
    : "";

  const notes = Array.isArray(report.verification_notes)
    ? report.verification_notes.map((n) => `<li>${esc(n)}</li>`).join("")
    : "";

  const srcRows = Array.isArray(item.sources)
    ? item.sources
        .slice(0, 8)
        .map((src) => {
          const label = esc(src.provider || "Nguồn");
          const note = src.note ? ` - ${esc(src.note)}` : "";
          if (src.url && src.url.startsWith("http")) {
            return `<li><a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${label}</a>${note}</li>`;
          }
          return `<li>${label}${note}</li>`;
        })
        .join("")
    : "";

  return `
  <article class="qa-item">
    <h4>Câu hỏi: ${esc(item.question || "")}</h4>
    <div class="answer-box">
      <strong>Kết luận trực tiếp</strong>
      <p>${formatMultiline(report.direct_answer || item.answer || "-")}</p>
      ${report.summary ? `<p><em>${esc(report.summary)}</em></p>` : ""}
      ${report.meta_note ? `<p><em>${esc(report.meta_note)}</em></p>` : ""}
    </div>
    <div class="report-grid">
      ${
        metricRows
          ? `<div class="table-wrap"><table><thead><tr><th>Chỉ số</th><th>Giá trị</th><th>Diễn giải</th></tr></thead><tbody>${metricRows}</tbody></table></div>`
          : ""
      }
      ${detailRows || ""}
      ${
        planRows
          ? `<div class="table-wrap"><table><thead><tr><th>Ưu tiên</th><th>Hành động</th><th>Thời gian</th><th>Lý do</th></tr></thead><tbody>${planRows}</tbody></table></div>`
          : ""
      }
      ${notes ? `<ul class="source-list">${notes}</ul>` : ""}
      ${report.sources_overview ? `<p>${esc(report.sources_overview)}</p>` : ""}
      <div class="chip-row">
        <span class="chip">AI: ${esc(item.tooling?.ai_provider || "none")}</span>
        <span class="chip">Web: ${item.tooling?.use_web_search ? "Bật" : "Tắt"}</span>
        <span class="chip">Calendar: ${item.tooling?.use_calendar ? "Bật" : "Tắt"}</span>
      </div>
      ${srcRows ? `<ul class="source-list">${srcRows}</ul>` : ""}
    </div>
  </article>`;
}

function renderCalendar(profile) {
  const events = Array.isArray(profile?.calendar) ? profile.calendar : [];
  if (!events.length) {
    ui.calendarList.innerHTML = '<div class="event-item"><p>Chưa có sự kiện.</p></div>';
    return;
  }

  ui.calendarList.innerHTML = events
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((evt) => {
      const link =
        evt.google_calendar_url && evt.google_calendar_url.startsWith("http")
          ? `<a href="${esc(evt.google_calendar_url)}" target="_blank" rel="noopener noreferrer">Thêm vào Google Calendar</a>`
          : "";
      return `
      <article class="event-item">
        <h4>${esc(evt.title || "Sự kiện")}</h4>
        <p>${esc(evt.date || "-")} | ${esc(evt.start_time || "--:--")} - ${esc(evt.end_time || "--:--")} (${esc(
        evt.timezone || ""
      )})</p>
        <p>${formatMultiline(evt.note || "")}</p>
        ${link}
      </article>`;
    })
    .join("");
}

function readForm() {
  return {
    name: clean(ui.fields.name.value),
    gender: clean(ui.fields.gender.value),
    birth_date: clean(ui.fields.birthDate.value),
    birth_chi: clean(ui.fields.birthChi.value),
    birth_place: clean(ui.fields.birthPlace.value),
    timezone: clean(ui.fields.timezone.value) || "Asia/Ho_Chi_Minh"
  };
}

function onNewProfile() {
  const profile = {
    id: uid(),
    name: "Người mới",
    gender: "Nam",
    birth_date: "1990-01-01",
    birth_chi: "Ngọ",
    birth_place: "",
    timezone: "Asia/Ho_Chi_Minh",
    analysis: null,
    qa: [],
    calendar: []
  };
  state.profiles.push(profile);
  state.selectedId = profile.id;
  setStatus("Đã tạo hồ sơ mới.");
  render();
  persist();
}

async function onSaveProfile() {
  const data = readForm();
  if (!data.name || !data.birth_date) {
    setStatus("Cần nhập tên và ngày sinh.", true);
    return;
  }

  let profile = selectedProfile();
  if (!profile) {
    profile = {
      id: uid(),
      analysis: null,
      qa: [],
      calendar: []
    };
    state.profiles.push(profile);
    state.selectedId = profile.id;
  }

  Object.assign(profile, data);
  setStatus("Đã lưu hồ sơ.");
  persist();
  render();
  await syncProfileIfCloud(profile);
}

async function onAnalyzeProfile(event) {
  event.preventDefault();
  await onSaveProfile();
  const profile = selectedProfile();
  if (!profile) return;

  setStatus("Đang phân tích Bát tự/Tử vi...");
  try {
    const res = await callApi({
      action: "analyze_profile",
      profile
    });
    profile.analysis = res;
    profile.birth_chi = res.profile?.birth_chi || profile.birth_chi;
    profile.calendar = mergeEvents(profile.calendar, res.calendar_suggestions || []);
    setStatus("Đã cập nhật bảng phân tích.");
    persist();
    render();
    await syncProfileIfCloud(profile);
  } catch (error) {
    setStatus(error.message || "Không phân tích được.", true);
  }
}

async function onDeleteProfile() {
  const profile = selectedProfile();
  if (!profile) return;
  const ok = window.confirm(`Xóa hồ sơ ${profile.name}?`);
  if (!ok) return;

  state.profiles = state.profiles.filter((p) => p.id !== profile.id);
  if (state.profiles.length === 0) {
    const seeded = seedState();
    state.profiles = seeded.profiles;
    state.selectedId = seeded.selectedId;
  } else {
    state.selectedId = state.profiles[0].id;
  }

  setStatus("Đã xóa hồ sơ.");
  persist();
  render();
  if (state.session.mode === "cloud" && state.session.token) {
    await deleteCloudProfile(profile.id).catch(() => {});
  }
}

async function onAskQuestion(event) {
  event.preventDefault();
  const profile = selectedProfile();
  if (!profile) {
    setStatus("Cần chọn hồ sơ trước.", true);
    return;
  }

  const question = clean(document.getElementById("question-input").value);
  if (!question) {
    setStatus("Bạn chưa nhập câu hỏi.", true);
    return;
  }

  if (!profile.analysis) {
    setStatus("Hồ sơ chưa có phân tích, đang tính...");
    try {
      profile.analysis = await callApi({ action: "analyze_profile", profile });
    } catch (error) {
      setStatus(error.message || "Không thể phân tích trước khi hỏi.", true);
      return;
    }
  }

  setStatus("Đang phân tích câu hỏi với AI + dữ liệu...");
  try {
    const payload = await callApi({
      action: "ask_profile",
      profile,
      question,
      use_ai: document.getElementById("use-ai").checked,
      use_web_search: document.getElementById("use-web").checked,
      use_calendar: document.getElementById("use-cal").checked
    });

    profile.analysis = payload.analysis || profile.analysis;
    profile.qa.push({
      id: uid(),
      created_at: payload.generated_at || new Date().toISOString(),
      question: payload.question || question,
      answer: payload.answer || "",
      report: payload.report || null,
      tooling: payload.tooling || {},
      sources: payload.sources || [],
      search_results: payload.search_results || []
    });
    if (Array.isArray(payload.calendar_events) && payload.calendar_events.length > 0) {
      profile.calendar = mergeEvents(profile.calendar, payload.calendar_events);
    }

    document.getElementById("question-input").value = "";
    setStatus("Đã có báo cáo chi tiết.");
    persist();
    render();
    switchTab("qa");
    await syncProfileIfCloud(profile);
  } catch (error) {
    setStatus(error.message || "Không đặt câu hỏi được.", true);
  }
}

async function onGenerateCalendar() {
  const profile = selectedProfile();
  if (!profile) return;

  if (!profile.analysis) {
    setStatus("Đang phân tích trước khi tạo lịch...");
    try {
      profile.analysis = await callApi({ action: "analyze_profile", profile });
    } catch (error) {
      setStatus(error.message || "Không thể phân tích.", true);
      return;
    }
  }

  setStatus("Đang tạo lịch đề xuất...");
  try {
    const res = await callApi({
      action: "calendar_plan",
      profile,
      focus: "Theo dõi mục tiêu tháng"
    });
    profile.calendar = mergeEvents(profile.calendar, res.events || []);
    setStatus("Đã cập nhật lịch.");
    persist();
    render();
    switchTab("calendar");
    await syncProfileIfCloud(profile);
  } catch (error) {
    setStatus(error.message || "Không tạo được lịch.", true);
  }
}

async function onRegister() {
  const email = clean(ui.auth.email.value).toLowerCase();
  const password = String(ui.auth.password.value || "");
  const displayName = clean(ui.auth.display.value || "Người dùng");
  if (!email || !password) {
    setAuthStatus("Thiếu email hoặc mật khẩu.", true);
    return;
  }
  try {
    const res = await fetchJson("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, display_name: displayName })
    });
    state.session = { token: res.token, user: res.user, mode: "cloud" };
    setAuthStatus(`Đăng ký thành công: ${res.user.email}`);
    await pushAllProfilesToCloud();
    persist();
    render();
  } catch (error) {
    setAuthStatus(error.message || "Đăng ký thất bại.", true);
  }
}

async function onLogin() {
  const email = clean(ui.auth.email.value).toLowerCase();
  const password = String(ui.auth.password.value || "");
  if (!email || !password) {
    setAuthStatus("Thiếu email hoặc mật khẩu.", true);
    return;
  }
  try {
    const res = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    state.session = { token: res.token, user: res.user, mode: "cloud" };
    setAuthStatus(`Đăng nhập thành công: ${res.user.email}`);
    await loadProfilesFromCloud();
    persist();
    render();
  } catch (error) {
    setAuthStatus(error.message || "Đăng nhập thất bại.", true);
  }
}

function onLogout() {
  state.session = { token: "", user: null, mode: "local" };
  setAuthStatus("Đã đăng xuất. Trở về chế độ local.");
  persist();
  render();
}

async function onSyncNow() {
  if (state.session.mode !== "cloud" || !state.session.token) {
    setAuthStatus("Chưa đăng nhập cloud.", true);
    return;
  }
  try {
    await pushAllProfilesToCloud();
    setAuthStatus("Đồng bộ cloud thành công.");
  } catch (error) {
    setAuthStatus(error.message || "Đồng bộ thất bại.", true);
  }
}

async function authMe() {
  return fetchJson("/api/auth/me", {
    headers: authHeaders()
  });
}

async function loadProfilesFromCloud() {
  const data = await fetchJson("/api/profiles", { headers: authHeaders() });
  const rows = Array.isArray(data.profiles) ? data.profiles : [];
  if (!rows.length) {
    await pushAllProfilesToCloud();
    return;
  }
  state.profiles = rows
    .map((row) => normalizeProfileRecord(row.data || {}))
    .filter((x) => x && x.id);
  if (!state.profiles.length) {
    const seeded = seedState();
    state.profiles = seeded.profiles;
  }
  if (!state.profiles.find((x) => x.id === state.selectedId)) {
    state.selectedId = state.profiles[0].id;
  }
}

async function pushAllProfilesToCloud() {
  for (const profile of state.profiles) {
    await saveCloudProfile(profile);
  }
}

async function syncProfileIfCloud(profile) {
  if (state.session.mode !== "cloud" || !state.session.token || !profile) return;
  try {
    await saveCloudProfile(profile);
  } catch (error) {
    setAuthStatus("Không sync được cloud: " + (error.message || "unknown"), true);
  }
}

async function saveCloudProfile(profile) {
  await fetchJson("/api/profiles", {
    method: "POST",
    headers: {
      ...authHeaders(),
      "content-type": "application/json"
    },
    body: JSON.stringify({ profile })
  });
}

async function deleteCloudProfile(id) {
  await fetchJson(`/api/profiles?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders()
  });
}

function authHeaders() {
  return state.session.token ? { authorization: `Bearer ${state.session.token}` } : {};
}

async function callApi(payload) {
  return fetchJson("/api/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function mergeEvents(oldEvents, newEvents) {
  const out = Array.isArray(oldEvents) ? oldEvents.slice() : [];
  const seen = new Set(out.map((e) => `${e.id || ""}|${e.date || ""}|${e.title || ""}`));
  for (const evt of Array.isArray(newEvents) ? newEvents : []) {
    const key = `${evt.id || ""}|${evt.date || ""}|${evt.title || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(evt);
  }
  return out;
}

function setStatus(message, isError = false) {
  ui.status.textContent = message || "";
  ui.status.style.color = isError ? "#a71d2a" : "";
}

function setAuthStatus(message, isError = false) {
  ui.auth.status.textContent = message || "";
  ui.auth.status.style.color = isError ? "#a71d2a" : "";
}

function formatMultiline(text) {
  const safe = esc(String(text || ""));
  return safe.replaceAll("\n", "<br>");
}

function clean(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function esc(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uid() {
  return `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
