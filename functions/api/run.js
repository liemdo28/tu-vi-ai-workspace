const CAN = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"];
const CHI = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"];
const CHI_ANIMAL = ["Chuột", "Trâu", "Hổ", "Mèo", "Rồng", "Rắn", "Ngựa", "Dê", "Khỉ", "Gà", "Chó", "Heo"];
const GIO_HD = ["110100101100", "001101001011", "110011010010", "101100110100", "001011001101", "010010110011"];
const WEEKDAY = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

const STEM_ELEMENT = {
  Giáp: "Mộc",
  Ất: "Mộc",
  Bính: "Hỏa",
  Đinh: "Hỏa",
  Mậu: "Thổ",
  Kỷ: "Thổ",
  Canh: "Kim",
  Tân: "Kim",
  Nhâm: "Thủy",
  Quý: "Thủy"
};

const BRANCH_ELEMENT = {
  Tý: "Thủy",
  Sửu: "Thổ",
  Dần: "Mộc",
  Mão: "Mộc",
  Thìn: "Thổ",
  Tỵ: "Hỏa",
  Ngọ: "Hỏa",
  Mùi: "Thổ",
  Thân: "Kim",
  Dậu: "Kim",
  Tuất: "Thổ",
  Hợi: "Thủy"
};

const HOURS = [
  { chi: "Tý", start: "23:00", end: "00:59" },
  { chi: "Sửu", start: "01:00", end: "02:59" },
  { chi: "Dần", start: "03:00", end: "04:59" },
  { chi: "Mão", start: "05:00", end: "06:59" },
  { chi: "Thìn", start: "07:00", end: "08:59" },
  { chi: "Tỵ", start: "09:00", end: "10:59" },
  { chi: "Ngọ", start: "11:00", end: "12:59" },
  { chi: "Mùi", start: "13:00", end: "14:59" },
  { chi: "Thân", start: "15:00", end: "16:59" },
  { chi: "Dậu", start: "17:00", end: "18:59" },
  { chi: "Tuất", start: "19:00", end: "20:59" },
  { chi: "Hợi", start: "21:00", end: "22:59" }
];

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = clean(body.action || "analyze_profile").toLowerCase();

    if (action === "analyze_profile") {
      const profile = body.profile && typeof body.profile === "object" ? body.profile : body;
      return json({ ok: true, action, ...analyzeProfile(profile) });
    }

    if (action === "ask_profile") {
      return json({ ok: true, action, ...(await askProfile(body, env)) });
    }

    if (action === "calendar_plan") {
      const profile = body.profile && typeof body.profile === "object" ? body.profile : body;
      const analysis = profile.analysis && profile.analysis.bazi ? profile.analysis : analyzeProfile(profile);
      return json({
        ok: true,
        action,
        generated_at: new Date().toISOString(),
        profile: analysis.profile,
        events: buildCalendarEvents(
          analysis.profile,
          analysis.bazi,
          analysis.elements,
          clean(body.focus) || "Theo dõi mục tiêu tháng"
        )
      });
    }

    return json({ ok: false, error: "Action không hợp lệ." }, 400);
  } catch (error) {
    return json(
      {
        ok: false,
        error: "Lỗi máy chủ khi xử lý.",
        detail: String(error && error.message ? error.message : error)
      },
      500
    );
  }
}

function analyzeProfile(input) {
  const profile = normalizeProfile(input);
  if (!profile.birth_date) throw new Error("Ngày sinh không hợp lệ. Định dạng đúng: YYYY-MM-DD.");

  const [yy, mm, dd] = profile.birth_date.split("-").map(Number);
  const jd = jdFromDate(dd, mm, yy);
  const lunar = convertSolar2Lunar(dd, mm, yy, profile.timezone_offset);

  const yearPillar = `${CAN[(lunar.year + 6) % 10]} ${CHI[(lunar.year + 8) % 12]}`;
  const monthPillar = `${CAN[(lunar.year * 12 + lunar.month + 3) % 10]} ${CHI[(lunar.month + 1) % 12]}`;
  const dayCanIdx = (jd + 9) % 10;
  const dayChiIdx = (jd + 1) % 12;
  const dayPillar = `${CAN[dayCanIdx]} ${CHI[dayChiIdx]}`;
  const hourIdx = hourIndexFromChi(profile.birth_chi);
  const hourCanIdx = ((dayCanIdx % 5) * 2 + hourIdx) % 10;
  const hourPillar = `${CAN[hourCanIdx]} ${CHI[hourIdx]}`;

  const elements = calcElements([yearPillar, monthPillar, dayPillar, hourPillar]);
  const hoangDao = goodHours(jd);
  const dayMaster = CAN[dayCanIdx];
  const dayMasterElement = STEM_ELEMENT[dayMaster] || "";

  const bazi = {
    year_pillar: yearPillar,
    month_pillar: monthPillar,
    day_pillar: dayPillar,
    hour_pillar: hourPillar,
    day_master: dayMaster,
    day_master_element: dayMasterElement,
    zodiac: CHI_ANIMAL[(lunar.year + 8) % 12]
  };

  const quality = buildQualityStats({
    elements,
    hoangDao,
    bazi,
    webItems: []
  });

  return {
    profile,
    solar: {
      date: profile.birth_date,
      birth_hour_branch: profile.birth_chi,
      weekday: WEEKDAY[new Date(`${profile.birth_date}T00:00:00`).getDay()],
      julian_day: jd
    },
    lunar: {
      day: lunar.day,
      month: lunar.month,
      year: lunar.year,
      is_leap_month: lunar.leap === 1,
      date_text: `${pad2(lunar.day)}/${pad2(lunar.month)}/${lunar.year}${lunar.leap ? " (nhuận)" : ""}`
    },
    bazi,
    hoang_dao_hours: hoangDao,
    elements,
    quality,
    tu_vi: {
      overview:
        `${profile.name} có mệnh cục theo 4 trụ: ${yearPillar} | ${monthPillar} | ${dayPillar} | ${hourPillar}. ` +
        `Nhật chủ ${dayMaster} (${dayMasterElement}).`,
      recommendations: [
        `Ngũ hành mạnh: ${elements.dominant.join(", ")}; ngũ hành yếu: ${elements.weakest.join(", ")}.`,
        `Giờ sinh chọn: ${profile.birth_chi} (${chiToRange(profile.birth_chi)}).`,
        "Nên theo dõi kết quả theo chu kỳ 30-90 ngày để hiệu chỉnh quyết định."
      ]
    },
    calendar_suggestions: buildCalendarEvents(profile, bazi, elements, "Xem tổng quan 30 ngày"),
    assumptions: [
      "Bát tự/Tử vi mang tính tham khảo.",
      "Âm lịch tính theo timezone hồ sơ.",
      "Giờ sinh dùng theo hệ Can Chi (Tý, Sửu, Dần...) thay vì giờ số."
    ],
    sources: [
      { provider: "Thuật toán lịch âm Việt Nam", note: "Julian day / new moon / sun longitude" },
      { provider: "Bản đồ Can Chi", note: "Quy tắc Can Chi truyền thống" }
    ]
  };
}

async function askProfile(body, env) {
  const question = clean(body.question);
  if (!question) throw new Error("Bạn cần nhập câu hỏi.");

  const profileRaw = body.profile && typeof body.profile === "object" ? body.profile : {};
  const analysis =
    profileRaw.analysis && profileRaw.analysis.bazi ? profileRaw.analysis : analyzeProfile(profileRaw);

  const useWeb = body.use_web_search !== false;
  const useAi = body.use_ai !== false;
  const useCalendar = body.use_calendar === true;

  const web = useWeb
    ? await webSearch(
        `${question} bát tự tử vi ngũ hành ${analysis.profile.name}`,
        clampInt(body.search_limit, 4, 12, 8),
        env
      )
    : { items: [], sources: [] };

  const quality = buildQualityStats({
    elements: analysis.elements,
    hoangDao: analysis.hoang_dao_hours,
    bazi: analysis.bazi,
    webItems: web.items
  });

  const heuristicReport = buildHeuristicReport(question, analysis, quality, web.items);

  let aiProvider = "heuristic";
  let finalReport = heuristicReport;
  let rawAiText = "";

  if (useAi && env.OPENAI_API_KEY) {
    const aiResult = await askOpenAI(question, analysis, quality, web.items, env);
    aiProvider = aiResult.provider;
    rawAiText = aiResult.raw_text || "";
    if (aiResult.report) {
      finalReport = mergeReports(heuristicReport, aiResult.report);
    }
  } else if (useAi && !env.OPENAI_API_KEY) {
    aiProvider = "heuristic-no-openai-key";
    finalReport.meta_note = "Chưa cấu hình OPENAI_API_KEY nên hệ thống trả lời bằng bộ phân tích nội bộ.";
  }

  const events = useCalendar
    ? buildCalendarEvents(analysis.profile, analysis.bazi, analysis.elements, question).slice(0, 4)
    : [];

  return {
    generated_at: new Date().toISOString(),
    profile: analysis.profile,
    question,
    answer: finalReport.direct_answer,
    report: finalReport,
    analysis: { ...analysis, quality },
    tooling: {
      use_ai: useAi,
      use_web_search: useWeb,
      use_calendar: useCalendar,
      ai_provider: aiProvider
    },
    search_results: web.items,
    calendar_events: events,
    sources: sourceList(web.sources, web.items, aiProvider),
    raw_ai_text: rawAiText
  };
}

function buildHeuristicReport(question, analysis, quality, webItems) {
  const intent = classifyQuestion(question);
  const dominant = analysis.elements.dominant.join(", ");
  const weak = analysis.elements.weakest.join(", ");
  const dayMaster = analysis.bazi.day_master;
  const dayElement = analysis.bazi.day_master_element;

  const directByIntent = {
    career:
      "Nên ưu tiên nâng năng lực cốt lõi và chọn mục tiêu nghề nghiệp 1-2 hướng, tránh dàn trải. Tập trung vào chu kỳ 90 ngày với KPI cụ thể.",
    finance:
      "Nên giữ kỷ luật dòng tiền, ưu tiên tích lũy và quản trị rủi ro trước khi mở rộng đầu tư. Chỉ giải ngân theo từng phần nhỏ có mốc kiểm chứng.",
    relationship:
      "Nên ưu tiên giao tiếp rõ ràng, nói trước kỳ vọng và giới hạn. Tránh quyết định cảm xúc trong các ngày/giờ xung khắc năng lượng.",
    health:
      "Nên ưu tiên nhịp sinh hoạt đều đặn, ngủ đúng giờ và theo dõi chỉ số sức khỏe theo tuần. Mệnh lý chỉ tham khảo, cần kiểm tra chuyên môn khi có vấn đề.",
    generic:
      "Nên xác định mục tiêu chính theo 30-90 ngày, hành động trong giờ thuận, và đo kết quả bằng số liệu thực tế để điều chỉnh."
  };

  const directAnswer =
    `${analysis.profile.name}: Nhật chủ ${dayMaster} (${dayElement}), ngũ hành mạnh ${dominant}, yếu ${weak}. ` +
    `${directByIntent[intent] || directByIntent.generic}`;

  const detailed = [
    {
      title: "Luận giải mệnh cục",
      content:
        `Bộ tứ trụ hiện tại cho thấy thiên hướng nổi bật ở ${dominant}. Phần yếu nằm ở ${weak}, ` +
        "vì vậy các quyết định lớn nên có bước kiểm chứng dữ liệu trước khi cam kết dài hạn."
    },
    {
      title: "Động lượng theo câu hỏi",
      content:
        `Với câu hỏi \"${question}\", hệ thống xếp nhóm ${intentLabel(intent)}. ` +
        "Ưu tiên chiến lược tuần tự: chuẩn hóa nền tảng -> thử nghiệm nhỏ -> mở rộng khi có chỉ số tốt."
    },
    {
      title: "Khung thời điểm",
      content:
        `Tỷ lệ giờ hoàng đạo hiện tại: ${quality.hour_success_ratio}. ` +
        "Nên đặt các việc quan trọng (đàm phán, quyết định, ký kết) vào các khung giờ thuận để tăng độ ổn định tâm lý và hiệu suất."
    }
  ];

  return {
    summary:
      "Báo cáo tổng hợp từ Bát tự/Tử vi + thống kê cân bằng ngũ hành + phân tích câu hỏi theo ngữ cảnh hành động.",
    direct_answer: directAnswer,
    metric_table: quality.metric_table,
    detailed_analysis: detailed,
    action_plan: buildActionPlan(intent, quality),
    verification_notes: [
      "Mệnh lý không thay thế dữ liệu thực tế.",
      "Các quyết định tài chính/sức khỏe/pháp lý cần tư vấn chuyên môn.",
      `Nguồn web hợp lệ đã dùng: ${webItems.length}.`
    ],
    sources_overview: summarizeSources(webItems),
    meta_note: ""
  };
}

function buildActionPlan(intent, quality) {
  const base = [
    {
      priority: "Cao",
      action: "Xác định 1 mục tiêu chính trong 90 ngày",
      timeline: "Trong 24 giờ",
      reason: "Giảm nhiễu quyết định và tập trung nguồn lực."
    },
    {
      priority: "Cao",
      action: "Chia mục tiêu thành KPI tuần",
      timeline: "Trong 3 ngày",
      reason: "Theo dõi tiến độ bằng số liệu thay vì cảm tính."
    }
  ];

  if (intent === "finance") {
    base.push({
      priority: "Trung bình",
      action: "Thiết lập ngưỡng rủi ro và giới hạn thua lỗ",
      timeline: "Trong 7 ngày",
      reason: "Điểm ổn định hiện tại ở mức " + quality.stability_score + ", cần kỷ luật phòng thủ."
    });
  } else if (intent === "career") {
    base.push({
      priority: "Trung bình",
      action: "Nâng một năng lực tạo giá trị cao nhất",
      timeline: "Trong 30 ngày",
      reason: "Tối ưu tốc độ thăng tiến với đòn bẩy kỹ năng."
    });
  } else {
    base.push({
      priority: "Trung bình",
      action: "Duy trì nhật ký quyết định và kết quả",
      timeline: "Trong 30 ngày",
      reason: "Tăng độ chính xác cho lần ra quyết định kế tiếp."
    });
  }

  return base;
}

function summarizeSources(items) {
  if (!Array.isArray(items) || items.length === 0) return "Không có nguồn web bổ sung.";
  const domains = new Map();
  for (const item of items) {
    const host = domainOf(item.url || "");
    if (!host) continue;
    domains.set(host, (domains.get(host) || 0) + 1);
  }
  const top = Array.from(domains.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([d, n]) => `${d} (${n})`);
  return top.length ? `Nguồn chính: ${top.join(", ")}.` : "Không xác định được domain nguồn.";
}

function buildQualityStats({ elements, hoangDao, bazi, webItems }) {
  const counts = elements.counts || {};
  const values = Object.values(counts);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const zeroCount = values.filter((x) => x === 0).length;

  const balanceScore = clamp(Math.round(100 - (maxVal - minVal) * 16 - zeroCount * 8), 10, 95);
  const dayMasterElement = bazi.day_master_element;
  const dayMasterPower = clamp(Math.round(35 + (counts[dayMasterElement] || 0) * 13), 20, 92);
  const hourRatioNum = Array.isArray(hoangDao) ? hoangDao.length / 12 : 0;
  const hourRatio = `${Math.round(hourRatioNum * 100)}%`;
  const sourceScore = sourceQualityScore(webItems);
  const stability = clamp(Math.round(balanceScore * 0.5 + dayMasterPower * 0.3 + sourceScore * 0.2), 20, 96);

  return {
    balance_score: balanceScore,
    day_master_power: dayMasterPower,
    source_score: sourceScore,
    stability_score: stability,
    hour_success_ratio: hourRatio,
    metric_table: [
      {
        metric: "Điểm cân bằng ngũ hành",
        value: `${balanceScore}/100`,
        meaning: balanceScore >= 70 ? "Cân bằng khá tốt" : "Thiên lệch tương đối, cần bù trừ hành yếu"
      },
      {
        metric: "Độ vững Nhật chủ",
        value: `${dayMasterPower}/100`,
        meaning: dayMasterPower >= 65 ? "Nội lực tốt để triển khai mục tiêu" : "Nên đi chậm và kiểm chứng theo bước"
      },
      {
        metric: "Tỷ lệ giờ thuận",
        value: hourRatio,
        meaning: "Tỷ lệ khung giờ hoàng đạo trong ngày"
      },
      {
        metric: "Chất lượng nguồn tham chiếu",
        value: `${sourceScore}/100`,
        meaning: sourceScore >= 65 ? "Nguồn khá tin cậy" : "Nguồn còn phân tán, cần chọn lọc"
      },
      {
        metric: "Điểm ổn định tổng hợp",
        value: `${stability}/100`,
        meaning: stability >= 70 ? "Có thể hành động chủ động" : "Nên ưu tiên phòng thủ và từng bước"
      }
    ]
  };
}

function sourceQualityScore(webItems) {
  if (!Array.isArray(webItems) || webItems.length === 0) return 40;
  let score = 35;
  for (const item of webItems.slice(0, 8)) {
    const host = domainOf(item.url || "");
    if (!host) continue;
    if (/\.(gov|edu)\b/i.test(host)) score += 12;
    else if (host.includes("wikipedia.org")) score += 10;
    else if (
      host.includes("vnexpress.net") ||
      host.includes("tuoitre.vn") ||
      host.includes("thanhnien.vn") ||
      host.includes("reuters.com") ||
      host.includes("bloomberg.com")
    )
      score += 8;
    else if (
      host.includes("facebook.com") ||
      host.includes("tiktok.com") ||
      host.includes("youtube.com") ||
      host.includes("instagram.com")
    )
      score -= 8;
    else score += 4;
  }
  return clamp(score, 20, 95);
}

async function askOpenAI(question, analysis, quality, webItems, env) {
  const model = clean(env.OPENAI_MODEL) || "gpt-4.1-mini";
  const schemaHint = {
    summary: "string",
    direct_answer: "string",
    detailed_analysis: [{ title: "string", content: "string" }],
    action_plan: [{ priority: "Cao|Trung bình|Thấp", action: "string", timeline: "string", reason: "string" }],
    verification_notes: ["string"]
  };

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        input: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text:
                  "Bạn là chuyên gia phân tích Bát tự/Tử vi cho người Việt. " +
                  "Trả lời chính xác trọng tâm câu hỏi, ngắn gọn nhưng đủ chiều sâu. " +
                  "Bắt buộc trả về JSON hợp lệ, không markdown, không thêm text ngoài JSON."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Câu hỏi: ${question}\n` +
                  `Hồ sơ: ${JSON.stringify(analysis.profile)}\n` +
                  `Bát tự: ${JSON.stringify(analysis.bazi)}\n` +
                  `Ngũ hành: ${JSON.stringify(analysis.elements)}\n` +
                  `Thống kê định lượng: ${JSON.stringify(quality.metric_table)}\n` +
                  `Nguồn web đã lọc: ${JSON.stringify(webItems.slice(0, 6))}\n` +
                  `Schema bắt buộc: ${JSON.stringify(schemaHint)}`
              }
            ]
          }
        ]
      })
    },
    45000
  );

  if (!res.ok) {
    return { report: null, provider: `openai-fallback-${res.status}`, raw_text: "" };
  }

  const data = await res.json().catch(() => ({}));
  const text = outputText(data);
  const parsed = parseJsonObject(text);

  if (!parsed || typeof parsed !== "object") {
    return { report: null, provider: `openai-unparsed-${model}`, raw_text: text || "" };
  }

  const report = {
    summary: clean(parsed.summary),
    direct_answer: clean(parsed.direct_answer),
    detailed_analysis: Array.isArray(parsed.detailed_analysis)
      ? parsed.detailed_analysis
          .map((x) => ({ title: clean(x.title), content: clean(x.content) }))
          .filter((x) => x.title && x.content)
      : [],
    action_plan: Array.isArray(parsed.action_plan)
      ? parsed.action_plan
          .map((x) => ({
            priority: clean(x.priority) || "Trung bình",
            action: clean(x.action),
            timeline: clean(x.timeline),
            reason: clean(x.reason)
          }))
          .filter((x) => x.action)
      : [],
    verification_notes: Array.isArray(parsed.verification_notes)
      ? parsed.verification_notes.map((x) => clean(String(x))).filter(Boolean)
      : []
  };

  return { report, provider: `openai-${model}`, raw_text: text || "" };
}

function mergeReports(base, ai) {
  return {
    summary: ai.summary || base.summary,
    direct_answer: ai.direct_answer || base.direct_answer,
    metric_table: base.metric_table,
    detailed_analysis: ai.detailed_analysis && ai.detailed_analysis.length ? ai.detailed_analysis : base.detailed_analysis,
    action_plan: ai.action_plan && ai.action_plan.length ? ai.action_plan : base.action_plan,
    verification_notes:
      ai.verification_notes && ai.verification_notes.length
        ? ai.verification_notes
        : base.verification_notes,
    sources_overview: base.sources_overview,
    meta_note: base.meta_note || ""
  };
}

function classifyQuestion(question) {
  const q = removeDiacritics(clean(question).toLowerCase());
  if (/cong viec|su nghiep|thang tien|job|nghe|kinh doanh/.test(q)) return "career";
  if (/tai chinh|tien|dau tu|co phieu|bat dong san|thu nhap/.test(q)) return "finance";
  if (/tinh cam|hon nhan|yeu|vo chong|gia dinh/.test(q)) return "relationship";
  if (/suc khoe|benh|than the|tam ly|ngu nghi/.test(q)) return "health";
  return "generic";
}

function intentLabel(intent) {
  if (intent === "career") return "Sự nghiệp";
  if (intent === "finance") return "Tài chính";
  if (intent === "relationship") return "Tình cảm";
  if (intent === "health") return "Sức khỏe";
  return "Tổng quát";
}

async function webSearch(query, limit, env) {
  if (env.SERPAPI_API_KEY) {
    const serp = await serpSearch(query, limit, env.SERPAPI_API_KEY);
    if (serp.items.length > 0) return serp;
  }

  const vi = await wikiSearch(query, "vi", Math.ceil(limit / 2));
  const en = await wikiSearch(query, "en", Math.floor(limit / 2) + 1);
  const out = [];
  const seen = new Set();
  for (const item of vi.items.concat(en.items)) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
    if (out.length >= limit) break;
  }
  return { items: out, sources: vi.sources.concat(en.sources) };
}

async function serpSearch(query, limit, key) {
  const req = new URL("https://serpapi.com/search.json");
  req.searchParams.set("engine", "google");
  req.searchParams.set("q", query);
  req.searchParams.set("num", String(Math.max(limit, 10)));
  req.searchParams.set("hl", "vi");
  req.searchParams.set("gl", "vn");
  req.searchParams.set("api_key", key);

  const safe = new URL("https://serpapi.com/search.json");
  safe.searchParams.set("engine", "google");
  safe.searchParams.set("q", query);
  safe.searchParams.set("num", String(limit));
  safe.searchParams.set("hl", "vi");
  safe.searchParams.set("gl", "vn");

  const res = await fetchWithTimeout(req.toString(), { method: "GET" }, 20000);
  if (!res.ok) {
    return {
      items: [],
      sources: [{ provider: "SerpAPI", url: safe.toString(), note: `HTTP ${res.status}` }]
    };
  }

  const data = await res.json().catch(() => ({}));
  const rows = Array.isArray(data.organic_results) ? data.organic_results : [];
  const blockedDomains = ["facebook.com", "tiktok.com", "youtube.com", "instagram.com"];

  const items = rows
    .map((x) => ({
      title: clean(x.title),
      snippet: clean(x.snippet),
      url: clean(x.link),
      source: clean(x.source || domainOf(x.link || "") || "Google")
    }))
    .filter((x) => x.title && x.url)
    .filter((x) => {
      const host = domainOf(x.url);
      return host && !blockedDomains.some((d) => host.includes(d));
    })
    .slice(0, limit);

  return {
    items,
    sources: [{ provider: "SerpAPI", url: safe.toString(), note: "Google search đã lọc domain nhiễu" }]
  };
}

async function wikiSearch(query, lang, limit) {
  const req = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  req.searchParams.set("action", "query");
  req.searchParams.set("list", "search");
  req.searchParams.set("srsearch", query);
  req.searchParams.set("format", "json");
  req.searchParams.set("srlimit", String(limit));
  req.searchParams.set("origin", "*");

  const res = await fetchWithTimeout(req.toString(), { method: "GET" }, 20000);
  if (!res.ok) {
    return {
      items: [],
      sources: [{ provider: `Wikipedia-${lang}`, url: req.toString(), note: `HTTP ${res.status}` }]
    };
  }

  const data = await res.json().catch(() => ({}));
  const rows = Array.isArray(data?.query?.search) ? data.query.search : [];
  return {
    items: rows
      .map((x) => {
        const title = clean(x.title);
        return {
          title,
          snippet: strip(clean(x.snippet)),
          url: title ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` : "",
          source: `Wikipedia (${lang})`
        };
      })
      .filter((x) => x.title && x.url)
      .slice(0, limit),
    sources: [{ provider: `Wikipedia-${lang}`, url: req.toString(), note: "MediaWiki search" }]
  };
}

function normalizeProfile(input) {
  const tz = clean(input.timezone || "Asia/Ho_Chi_Minh") || "Asia/Ho_Chi_Minh";
  const birthChiRaw = clean(input.birth_chi || input.birthChi || "");
  const birthTimeRaw = clean(input.birth_time || input.birthTime || "");
  const birthChi = normalizeChi(birthChiRaw) || chiFromHourIndex(hourIndexFromTime(birthTimeRaw || "12:00")) || "Ngọ";

  return {
    name: clean(input.name || "Người dùng"),
    gender: genderOf(input.gender),
    birth_date: validDate(clean(input.birth_date || input.birthDate)) || "",
    birth_chi: birthChi,
    birth_time: chiToRepresentativeTime(birthChi),
    birth_place: clean(input.birth_place || input.birthPlace || ""),
    timezone: tz,
    timezone_offset: tzOffset(tz, input.timezone_offset)
  };
}

function genderOf(v) {
  const x = removeDiacritics(clean(v).toLowerCase());
  if (["nam", "male", "m"].includes(x)) return "Nam";
  if (["nu", "female", "f"].includes(x)) return "Nữ";
  if (!x) return "Không rõ";
  return "Khác";
}

function validDate(raw) {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return "";
  return raw;
}

function hourIndexFromTime(rawTime) {
  const [hText, mText] = validTime(rawTime).split(":");
  const total = Number(hText) * 60 + Number(mText);
  if (total >= 1380 || total < 60) return 0;
  if (total < 180) return 1;
  if (total < 300) return 2;
  if (total < 420) return 3;
  if (total < 540) return 4;
  if (total < 660) return 5;
  if (total < 780) return 6;
  if (total < 900) return 7;
  if (total < 1020) return 8;
  if (total < 1140) return 9;
  if (total < 1260) return 10;
  return 11;
}

function hourIndexFromChi(chiText) {
  const normalized = normalizeChi(chiText);
  const idx = CHI.findIndex((x) => x === normalized);
  return idx >= 0 ? idx : 6;
}

function chiFromHourIndex(index) {
  const i = clampInt(index, 0, 11, 6);
  return CHI[i];
}

function normalizeChi(input) {
  const plain = removeDiacritics(clean(input).toLowerCase());
  const map = {
    ty: "Tý",
    suu: "Sửu",
    dan: "Dần",
    mao: "Mão",
    thin: "Thìn",
    ti: "Tỵ",
    ngo: "Ngọ",
    mui: "Mùi",
    than: "Thân",
    dau: "Dậu",
    tuat: "Tuất",
    hoi: "Hợi"
  };
  return map[plain] || "";
}

function chiToRepresentativeTime(chi) {
  const idx = hourIndexFromChi(chi);
  return HOURS[idx]?.start || "11:00";
}

function chiToRange(chi) {
  const idx = hourIndexFromChi(chi);
  const slot = HOURS[idx];
  return slot ? `${slot.start}-${slot.end}` : "-";
}

function validTime(raw) {
  const m = String(raw || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "12:00";
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return "12:00";
  return `${pad2(h)}:${pad2(mm)}`;
}

function tzOffset(name, explicit) {
  const n = Number(explicit);
  if (Number.isFinite(n) && n >= -12 && n <= 14) return n;
  const s = clean(name).toLowerCase();
  if (s.includes("ho_chi_minh") || s.includes("asia/saigon")) return 7;
  const m = s.match(/([+-]\d{1,2})(?::?(\d{2}))?$/);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2] || "0");
    return h + (h < 0 ? -1 : 1) * min / 60;
  }
  return 7;
}

function calcElements(pillars) {
  const counts = { Mộc: 0, Hỏa: 0, Thổ: 0, Kim: 0, Thủy: 0 };
  for (const p of pillars) {
    const [stem, branch] = clean(p).split(" ");
    if (STEM_ELEMENT[stem]) counts[STEM_ELEMENT[stem]] += 1;
    if (BRANCH_ELEMENT[branch]) counts[BRANCH_ELEMENT[branch]] += 1;
  }
  const vals = Object.values(counts);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const dominant = Object.keys(counts).filter((k) => counts[k] === max);
  const weakest = Object.keys(counts).filter((k) => counts[k] === min);
  return { counts, dominant, weakest, favorable: dominant };
}

function goodHours(jd) {
  const pat = GIO_HD[((jd + 1) % 12) % 6];
  const out = [];
  for (let i = 0; i < 12; i += 1) {
    if (pat[i] !== "1") continue;
    out.push({
      index: i,
      chi: HOURS[i].chi,
      start: HOURS[i].start,
      end: HOURS[i].end,
      range: `${HOURS[i].start}-${HOURS[i].end}`
    });
  }
  return out;
}

function buildCalendarEvents(profile, bazi, elements, focus) {
  const fav = elements.favorable || [];
  const preferChi = profile.birth_chi || "Ngọ";
  const preferHourIdx = hourIndexFromChi(preferChi);
  const tz = profile.timezone || "Asia/Ho_Chi_Minh";
  const off = Number(profile.timezone_offset || 7);
  const events = [];
  const now = new Date();

  for (let d = 1; d <= 45 && events.length < 6; d += 1) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const day = dt.getUTCDate();
    const jd = jdFromDate(day, m, y);

    const can = CAN[(jd + 9) % 10];
    const chi = CHI[(jd + 1) % 12];
    const e = BRANCH_ELEMENT[chi] || STEM_ELEMENT[can] || "";
    const gd = goodHours(jd);
    const slot = gd.find((x) => x.index === preferHourIdx) || gd[0];

    if (!slot) continue;
    if (!fav.includes(e) && !gd.find((x) => x.index === preferHourIdx)) continue;

    const date = `${y}-${pad2(m)}-${pad2(day)}`;
    const title = `Nhân mệnh ${profile.name} - ${focus || "Xem tổng quan"}`;
    const note =
      `Bát tự: ${bazi.year_pillar} | ${bazi.month_pillar} | ${bazi.day_pillar} | ${bazi.hour_pillar}\n` +
      `Ngày: ${can} ${chi} (${e})\nGợi ý giờ: ${slot.chi} (${slot.range})`;

    const start = slot.start;
    const end = addMinutes(start, 60);

    events.push({
      id: `evt-${date}-${events.length + 1}`,
      title,
      date,
      start_time: start,
      end_time: end,
      timezone: tz,
      note,
      google_calendar_url: googleCalendarUrl(title, note, profile.birth_place || "Online", date, start, end, tz, off)
    });
  }

  return events;
}

function googleCalendarUrl(title, details, location, date, start, end, timezone, offset) {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("details", details);
  url.searchParams.set("location", location);
  url.searchParams.set("dates", `${toUtcStamp(date, start, offset)}/${toUtcStamp(date, end, offset)}`);
  url.searchParams.set("ctz", timezone || "Asia/Ho_Chi_Minh");
  return url.toString();
}

function toUtcStamp(date, time, offset) {
  const d = validDate(date);
  const t = validTime(time);
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day, hh - offset, mm, 0));
  return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}T${pad2(dt.getUTCHours())}${pad2(dt.getUTCMinutes())}00Z`;
}

function addMinutes(time, mins) {
  const [h, m] = validTime(time).split(":").map(Number);
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function sourceList(declared, webItems, aiProvider) {
  const out = [];
  for (const x of Array.isArray(declared) ? declared : []) {
    out.push({ provider: clean(x.provider), url: clean(x.url || ""), note: clean(x.note || "") });
  }
  for (const x of Array.isArray(webItems) ? webItems.slice(0, 8) : []) {
    out.push({ provider: clean(x.source), url: clean(x.url), note: clean(x.title) });
  }
  out.push({ provider: "AI", url: "", note: aiProvider || "none" });
  const seen = new Set();
  return out.filter((x) => {
    const k = `${x.provider}|${x.url}|${x.note}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function domainOf(urlText) {
  try {
    return new URL(urlText).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function outputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  const out = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === "string" && part.text.trim()) out.push(part.text.trim());
    }
  }
  return out.join("\n").trim();
}

function parseJsonObject(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) return null;
    const maybe = text.slice(first, last + 1);
    try {
      return JSON.parse(maybe);
    } catch {
      return null;
    }
  }
}

function clean(v) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}
function strip(v) {
  return String(v || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function removeDiacritics(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function pad2(v) {
  return String(Number(v)).padStart(2, "0");
}
function clampInt(v, min, max, fallback) {
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function clamp(v, min, max) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}
async function fetchWithTimeout(url, init, timeoutMs) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function int(v) {
  return Math.floor(v);
}

function jdFromDate(dd, mm, yy) {
  const a = int((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + int((153 * m + 2) / 5) + 365 * y + int(y / 4) - int(y / 100) + int(y / 400) - 32045;
  if (jd < 2299161) jd = dd + int((153 * m + 2) / 5) + 365 * y + int(y / 4) - 32083;
  return jd;
}

function convertSolar2Lunar(dd, mm, yy, timeZone) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = int((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, timeZone);
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear;

  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }

  const lunarDay = dayNumber - monthStart + 1;
  const diff = int((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;

  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) lunarLeap = 1;
    }
  }

  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

function getNewMoonDay(k, timeZone) {
  return int(newMoon(k) + 0.5 + timeZone / 24);
}

function getLunarMonth11(yy, timeZone) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = int(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  if (getSunLongitude(nm, timeZone) >= 9) nm = getNewMoonDay(k - 1, timeZone);
  return nm;
}

function getLeapMonthOffset(a11, timeZone) {
  const k = int(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i += 1;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

function getSunLongitude(dayNumber, timeZone) {
  return int((sunLongitude(dayNumber - 0.5 - timeZone / 24) / Math.PI) * 6);
}

function sunLongitude(jdn) {
  const t = (jdn - 2451545.0) / 36525;
  const t2 = t * t;
  const dr = Math.PI / 180;
  const m = 357.5291 + 35999.0503 * t - 0.0001559 * t2 - 0.00000048 * t * t2;
  const l0 = 280.46645 + 36000.76983 * t + 0.0003032 * t2;
  const dl =
    (1.9146 - 0.004817 * t - 0.000014 * t2) * Math.sin(dr * m) +
    (0.019993 - 0.000101 * t) * Math.sin(dr * 2 * m) +
    0.00029 * Math.sin(dr * 3 * m);
  let l = l0 + dl;
  l *= dr;
  l -= Math.PI * 2 * int(l / (Math.PI * 2));
  return l;
}

function newMoon(k) {
  const t = k / 1236.85;
  const t2 = t * t;
  const t3 = t2 * t;
  const dr = Math.PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * t - 0.009173 * t2) * dr);
  const m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3;
  const mpr = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3;
  const f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3;
  let c1 = (0.1734 - 0.000393 * t) * Math.sin(m * dr) + 0.0021 * Math.sin(2 * dr * m);
  c1 -= 0.4068 * Math.sin(mpr * dr) + 0.0161 * Math.sin(dr * 2 * mpr);
  c1 -= 0.0004 * Math.sin(dr * 3 * mpr);
  c1 += 0.0104 * Math.sin(dr * 2 * f) - 0.0051 * Math.sin(dr * (m + mpr));
  c1 -= 0.0074 * Math.sin(dr * (m - mpr)) + 0.0004 * Math.sin(dr * (2 * f + m));
  c1 -= 0.0004 * Math.sin(dr * (2 * f - m)) - 0.0006 * Math.sin(dr * (2 * f + mpr));
  c1 += 0.001 * Math.sin(dr * (2 * f - mpr)) + 0.0005 * Math.sin(dr * (2 * mpr + m));
  const deltaT =
    t < -11
      ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
      : -0.000278 + 0.000265 * t + 0.000262 * t2;
  return jd1 + c1 - deltaT;
}
