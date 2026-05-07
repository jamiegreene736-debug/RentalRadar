import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const width = 1280;
const height = 720;
const fps = 15;
const duration = 47;
const frameCount = duration * fps;
const outputDir = "apps/web/public";
const frameDir = ".video-frames/pricing-superiority";
const videoPath = `${outputDir}/pricing-superiority-overview.mp4`;
const posterPath = `${outputDir}/pricing-superiority-poster.jpg`;

mkdirSync(outputDir, { recursive: true });
rmSync(frameDir, { recursive: true, force: true });
mkdirSync(frameDir, { recursive: true });

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const pulse = (t) => (Math.sin(t * Math.PI * 2) + 1) / 2;
const sceneProgress = (time, start, end) => clamp((time - start) / (end - start));
const sceneAlpha = (time, start, end, fade = 0.9) =>
  clamp(Math.min(sceneProgress(time, start, start + fade), sceneProgress(time, end, end - fade)));
const xml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function text({ x, y, value, size = 32, weight = 600, fill = "#f8fafc", anchor = "start", opacity = 1, family = "Inter, Arial, sans-serif" }) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${xml(value)}</text>`;
}

function rect({ x, y, w, h, r = 16, fill = "none", stroke = "none", sw = 1, opacity = 1, filter = "" }) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" ${filter ? `filter="${filter}"` : ""}/>`;
}

function line({ x1, y1, x2, y2, stroke = "#67e8f9", sw = 3, opacity = 1 }) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" opacity="${opacity}"/>`;
}

function cursor(x, y, opacity = 1) {
  return `
    <g transform="translate(${x} ${y})" opacity="${opacity}">
      <path d="M0 0 L0 31 L9 23 L15 39 L23 36 L16 21 L28 21 Z" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>
      <circle cx="7" cy="7" r="18" fill="none" stroke="#22d3ee" stroke-width="2" opacity="0.35"/>
    </g>`;
}

function browserChrome(time, address, body, accent = "#22d3ee", opacity = 1) {
  const glow = 0.14 + 0.12 * pulse(time * 0.4);
  return `
    <g opacity="${opacity}">
      ${rect({ x: 112, y: 96, w: 1056, h: 520, r: 30, fill: "#f8fafc", stroke: "rgba(14,116,144,0.24)", sw: 2, filter: "url(#softShadow)" })}
      <path d="M142 96 H1138 A30 30 0 0 1 1168 126 V172 H112 V126 A30 30 0 0 1 142 96 Z" fill="#eef8fb"/>
      <circle cx="154" cy="136" r="8" fill="#fb7185"/>
      <circle cx="181" cy="136" r="8" fill="#fbbf24"/>
      <circle cx="208" cy="136" r="8" fill="#34d399"/>
      ${rect({ x: 252, y: 116, w: 590, h: 40, r: 20, fill: "#ffffff", stroke: "rgba(14,116,144,0.18)" })}
      ${text({ x: 282, y: 142, value: address, size: 17, weight: 600, fill: "#0f172a" })}
      <circle cx="1032" cy="136" r="20" fill="${accent}" opacity="${glow}"/>
      ${text({ x: 960, y: 142, value: "headed Chrome", size: 16, weight: 700, fill: "#0e7490" })}
      <clipPath id="browserBodyClip"><rect x="112" y="172" width="1056" height="444" rx="0"/></clipPath>
      <g clip-path="url(#browserBodyClip)">${body}</g>
    </g>`;
}

function aiPanel(time, lines, x = 884, y = 205, opacity = 1) {
  return `
    <g opacity="${opacity}">
      ${rect({ x, y, w: 236, h: 294, r: 22, fill: "#0f172a", stroke: "rgba(103,232,249,0.32)", sw: 1.5 })}
      <circle cx="${x + 36}" cy="${y + 36}" r="17" fill="#22d3ee" opacity="${0.18 + pulse(time) * 0.16}"/>
      ${text({ x: x + 60, y: y + 42, value: "AI navigator", size: 17, weight: 800, fill: "#e0f2fe" })}
      ${lines
        .map((lineValue, i) => {
          const active = pulse(time * 0.55 + i * 0.17) > 0.42;
          return `
            <g transform="translate(${x + 22} ${y + 78 + i * 42})">
              <circle cx="8" cy="8" r="8" fill="${active ? "#34d399" : "#164e63"}"/>
              ${text({ x: 28, y: 13, value: lineValue, size: 15, weight: active ? 760 : 600, fill: active ? "#ccfbf1" : "#94a3b8" })}
            </g>`;
        })
        .join("")}
    </g>`;
}

function calendarGrid(time, x, y, opacity = 1) {
  const cells = Array.from({ length: 28 }, (_, index) => {
    const col = index % 7;
    const row = Math.floor(index / 7);
    const hot = (index + Math.floor(time * 2)) % 9 === 0;
    const fill = hot ? "#fef3c7" : index % 5 === 0 ? "#cffafe" : "#eef8fb";
    const stroke = hot ? "#f59e0b" : "rgba(14,116,144,0.16)";
    return `
      <g transform="translate(${x + col * 61} ${y + row * 52})">
        ${rect({ x: 0, y: 0, w: 48, h: 40, r: 10, fill, stroke, sw: hot ? 2 : 1 })}
        ${text({ x: 10, y: 17, value: `$${240 + ((index * 13) % 86)}`, size: 12, weight: 800, fill: hot ? "#92400e" : "#0f172a" })}
        <path d="M9 28 H36" stroke="${hot ? "#f59e0b" : "#22d3ee"}" stroke-width="4" stroke-linecap="round" opacity="0.72"/>
      </g>`;
  }).join("");
  return `<g opacity="${opacity}">${cells}</g>`;
}

function compCards(time, opacity = 1) {
  const providers = [
    ["Airbnb", "$286", "guest sees this now", "#fb7185"],
    ["VRBO", "$301", "weekend demand", "#60a5fa"],
    ["Booking.com", "$274", "gap-night signal", "#fbbf24"],
  ];
  return providers
    .map(([name, price, note, color], i) => {
      const y = 224 + i * 94;
      const scan = 0.25 + 0.22 * pulse(time * 0.7 + i * 0.23);
      return `
        <g opacity="${opacity}" transform="translate(${128 + i * 12} ${y})">
          ${rect({ x: 0, y: 0, w: 335, h: 72, r: 18, fill: "#ffffff", stroke: "rgba(14,116,144,0.16)", sw: 1.5 })}
          <circle cx="34" cy="36" r="17" fill="${color}" opacity="0.2"/>
          ${text({ x: 64, y: 31, value: name, size: 18, weight: 800, fill: "#0f172a" })}
          ${text({ x: 64, y: 53, value: note, size: 13, weight: 600, fill: "#64748b" })}
          ${text({ x: 280, y: 43, value: price, size: 22, weight: 900, fill: "#0f172a", anchor: "middle" })}
          <path d="M14 ${60 * scan} H320" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.45"/>
        </g>`;
    })
    .join("");
}

function barChart(time, opacity = 1) {
  const bars = [168, 218, 184, 266, 238, 310, 282];
  return `
    <g opacity="${opacity}">
      ${rect({ x: 138, y: 235, w: 430, h: 260, r: 24, fill: "#ffffff", stroke: "rgba(14,116,144,0.16)" })}
      ${text({ x: 170, y: 278, value: "Live comps + booking pace", size: 22, weight: 850, fill: "#0f172a" })}
      ${bars
        .map((bar, i) => {
          const animated = bar * (0.78 + 0.22 * easeInOut(sceneProgress(time % 6, i * 0.45, i * 0.45 + 1.7)));
          const x = 174 + i * 50;
          return `${rect({ x, y: 458 - animated * 0.62, w: 28, h: animated * 0.62, r: 8, fill: i === 5 ? "#f59e0b" : i > 3 ? "#14b8a6" : "#22d3ee", opacity: 0.84 })}`;
        })
        .join("")}
      ${line({ x1: 164, y1: 402, x2: 532, y2: 320, stroke: "#0f766e", sw: 4, opacity: 0.82 })}
      ${text({ x: 172, y: 524, value: "Market feed alone misses booking momentum", size: 15, weight: 700, fill: "#475569" })}
    </g>`;
}

function decisionGrid(time, opacity = 1) {
  const tiles = [
    ["Fri", "$312", "raise", "#dcfce7"],
    ["Sat", "$329", "raise", "#dcfce7"],
    ["Sun", "$246", "fill", "#fef3c7"],
    ["Mon", "$218", "hold", "#e0f2fe"],
    ["Tue", "$211", "hold", "#e0f2fe"],
    ["Wed", "$224", "event", "#fee2e2"],
  ];
  return `
    <g opacity="${opacity}">
      ${rect({ x: 139, y: 218, w: 496, h: 284, r: 26, fill: "#ffffff", stroke: "rgba(14,116,144,0.16)" })}
      ${text({ x: 172, y: 260, value: "Recommended moves", size: 24, weight: 900, fill: "#0f172a" })}
      ${tiles
        .map(([day, price, tag, fill], i) => {
          const x = 172 + (i % 3) * 146;
          const y = 292 + Math.floor(i / 3) * 88;
          const active = pulse(time * 0.45 + i * 0.13) > 0.58;
          return `
            <g transform="translate(${x} ${y})">
              ${rect({ x: 0, y: 0, w: 122, h: 66, r: 16, fill, stroke: active ? "#0e7490" : "rgba(14,116,144,0.12)", sw: active ? 2.2 : 1 })}
              ${text({ x: 16, y: 25, value: day, size: 14, weight: 800, fill: "#475569" })}
              ${text({ x: 16, y: 51, value: price, size: 22, weight: 900, fill: "#0f172a" })}
              ${text({ x: 92, y: 25, value: tag, size: 12, weight: 800, fill: "#0e7490", anchor: "middle" })}
            </g>`;
        })
        .join("")}
    </g>`;
}

function explanationStack(time, opacity = 1) {
  const items = [
    ["Demand", "Weekend comps are 14% higher than your current rate"],
    ["Pace", "Bookings are arriving 9 days faster than last month"],
    ["Guardrails", "Owner minimums and max nightly swing respected"],
    ["Action", "Push PMS first, extension fallback queued"],
  ];
  return `
    <g opacity="${opacity}">
      ${items
        .map(([title, copy], i) => {
          const y = 212 + i * 75;
          const active = pulse(time * 0.48 + i * 0.12) > 0.45;
          return `
            <g transform="translate(140 ${y})">
              ${rect({ x: 0, y: 0, w: 560, h: 58, r: 17, fill: active ? "#ecfeff" : "#ffffff", stroke: active ? "#22d3ee" : "rgba(14,116,144,0.15)", sw: active ? 2 : 1 })}
              <circle cx="30" cy="29" r="13" fill="${active ? "#14b8a6" : "#bae6fd"}"/>
              ${text({ x: 58, y: 25, value: title, size: 15, weight: 900, fill: "#0f172a" })}
              ${text({ x: 58, y: 45, value: copy, size: 14, weight: 650, fill: "#475569" })}
            </g>`;
        })
        .join("")}
    </g>`;
}

function finalPush(time, opacity = 1) {
  const progress = easeInOut(sceneProgress(time % 8, 0.5, 6.8));
  return `
    <g opacity="${opacity}">
      ${rect({ x: 144, y: 218, w: 465, h: 282, r: 26, fill: "#ffffff", stroke: "rgba(14,116,144,0.16)" })}
      ${text({ x: 176, y: 262, value: "Ready to publish", size: 25, weight: 900, fill: "#0f172a" })}
      ${["PMS API", "Chrome extension", "Owner guardrails"].map((item, i) => `
        <g transform="translate(178 ${294 + i * 50})">
          <circle cx="12" cy="12" r="12" fill="#dcfce7"/>
          <path d="M6 12 L11 17 L19 7" stroke="#047857" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          ${text({ x: 38, y: 18, value: item, size: 17, weight: 760, fill: "#0f172a" })}
        </g>`).join("")}
      ${rect({ x: 178, y: 444, w: 364, h: 18, r: 9, fill: "#e2e8f0" })}
      ${rect({ x: 178, y: 444, w: 364 * progress, h: 18, r: 9, fill: "#22d3ee" })}
      ${text({ x: 360, y: 533, value: "+$18,420 projected annual upside", size: 30, weight: 950, fill: "#0f766e", anchor: "middle" })}
    </g>`;
}

function sceneBody(time) {
  const s1 = sceneAlpha(time, 0, 7);
  const s2 = sceneAlpha(time, 6, 15);
  const s3 = sceneAlpha(time, 14, 24);
  const s4 = sceneAlpha(time, 23, 33);
  const s5 = sceneAlpha(time, 32, 40);
  const s6 = sceneAlpha(time, 39, 47);

  const titleSlide = `
    <g opacity="${s1}">
      ${rect({ x: 112, y: 172, w: 1056, h: 444, r: 0, fill: "#f8fafc" })}
      <path d="M150 526 C285 428 366 498 495 389 C598 303 697 313 822 220 C920 148 1036 179 1132 126" fill="none" stroke="#22d3ee" stroke-width="10" stroke-linecap="round" opacity="0.18"/>
      ${text({ x: 165, y: 272, value: "A pricing engine that sees live demand", size: 36, weight: 950, fill: "#0f172a" })}
      ${text({ x: 165, y: 323, value: "and understands booking pace.", size: 34, weight: 850, fill: "#0e7490" })}
      ${text({ x: 166, y: 382, value: "Headed Chrome evidence + revenue history + direct execution.", size: 21, weight: 680, fill: "#475569" })}
      ${aiPanel(time, ["open browser", "read visible rates", "collect evidence"], 836, 238, s1)}
    </g>`;

  const visitX = lerp(225, 654, easeInOut(sceneProgress(time, 7, 14)));
  const visitY = lerp(306, 464, easeInOut(sceneProgress(time, 7, 14)));
  const scanBody = `
    <g opacity="${s2}">
      ${rect({ x: 112, y: 172, w: 1056, h: 444, r: 0, fill: "#f8fafc" })}
      ${text({ x: 138, y: 216, value: "The AI navigates guest-visible sites in a real browser", size: 28, weight: 900, fill: "#0f172a" })}
      ${compCards(time, s2)}
      ${aiPanel(time, ["Airbnb calendar", "VRBO price check", "Booking gap nights"], 858, 226, s2)}
      ${cursor(visitX, visitY, s2)}
    </g>`;

  const chartBody = `
    <g opacity="${s3}">
      ${rect({ x: 112, y: 172, w: 1056, h: 444, r: 0, fill: "#f8fafc" })}
      ${text({ x: 138, y: 216, value: "Then it cross-checks live comps against what you are actually earning", size: 27, weight: 900, fill: "#0f172a" })}
      ${barChart(time, s3)}
      ${calendarGrid(time, 652, 248, s3)}
      ${aiPanel(time, ["booking pace", "lead time", "occupancy", "rate limits"], 862, 224, s3)}
    </g>`;

  const decisionBody = `
    <g opacity="${s4}">
      ${rect({ x: 112, y: 172, w: 1056, h: 444, r: 0, fill: "#f8fafc" })}
      ${text({ x: 138, y: 216, value: "Superior pricing is knowing which nights to raise, hold, or fill", size: 28, weight: 900, fill: "#0f172a" })}
      ${decisionGrid(time, s4)}
      ${rect({ x: 676, y: 246, w: 416, h: 205, r: 24, fill: "#0f172a", stroke: "rgba(34,211,238,0.35)" })}
      ${text({ x: 708, y: 296, value: "Competitor feed", size: 18, weight: 800, fill: "#94a3b8" })}
      ${text({ x: 708, y: 335, value: "market estimate only", size: 28, weight: 900, fill: "#e2e8f0" })}
      ${text({ x: 708, y: 391, value: "RentalRadar", size: 18, weight: 900, fill: "#67e8f9" })}
      ${text({ x: 708, y: 431, value: "live evidence + bookings", size: 28, weight: 950, fill: "#ccfbf1" })}
    </g>`;

  const explainBody = `
    <g opacity="${s5}">
      ${rect({ x: 112, y: 172, w: 1056, h: 444, r: 0, fill: "#f8fafc" })}
      ${text({ x: 138, y: 216, value: "Every recommendation comes with evidence, not mystery math", size: 28, weight: 900, fill: "#0f172a" })}
      ${explanationStack(time, s5)}
      ${aiPanel(time, ["why this price", "what changed", "how to publish"], 828, 236, s5)}
    </g>`;

  const finalBody = `
    <g opacity="${s6}">
      ${rect({ x: 112, y: 172, w: 1056, h: 444, r: 0, fill: "#f8fafc" })}
      ${text({ x: 138, y: 216, value: "Publish through your PMS, extension, or supervised browser flow", size: 28, weight: 900, fill: "#0f172a" })}
      ${finalPush(time, s6)}
      ${aiPanel(time, ["verify target page", "apply guarded rates", "log evidence"], 828, 236, s6)}
    </g>`;

  const address =
    time < 7
      ? "rentalradar.ai/ai-pricing"
      : time < 15
        ? ["airbnb.com/hosting/calendar", "vrbo.com/dashboard/rates", "admin.booking.com/rates"][Math.floor(time * 0.58) % 3]
        : time < 24
          ? "rentalradar.ai/live-market-evidence"
          : time < 33
            ? "rentalradar.ai/recommendations"
            : time < 40
              ? "rentalradar.ai/price-explainer"
              : "rentalradar.ai/publish";

  return browserChrome(time, address, `${titleSlide}${scanBody}${chartBody}${decisionBody}${explainBody}${finalBody}`);
}

function svgFrame(frame) {
  const time = frame / fps;
  const globalProgress = frame / (frameCount - 1);
  const beam = 100 + Math.sin(time * 0.7) * 34;
  const headline =
    time < 15
      ? "See the live market"
      : time < 33
        ? "Price from evidence"
        : "Push with guardrails";
  const subhead =
    time < 15
      ? "The AI watches actual guest-visible rates in headed Chrome."
      : time < 33
        ? "Recommendations blend comps, occupancy, pickup, and revenue pace."
        : "Every move is explainable, bounded, and ready to execute.";

  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="24" stdDeviation="34" flood-color="#0f172a" flood-opacity="0.18"/>
      </filter>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f8fdff"/>
        <stop offset="0.48" stop-color="#ecfeff"/>
        <stop offset="1" stop-color="#fff7ed"/>
      </linearGradient>
      <radialGradient id="cyanGlow" cx="24%" cy="16%" r="60%">
        <stop offset="0" stop-color="#67e8f9" stop-opacity="0.42"/>
        <stop offset="1" stop-color="#67e8f9" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="goldGlow" cx="84%" cy="78%" r="52%">
        <stop offset="0" stop-color="#fbbf24" stop-opacity="0.2"/>
        <stop offset="1" stop-color="#fbbf24" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect width="${width}" height="${height}" fill="url(#cyanGlow)"/>
    <rect width="${width}" height="${height}" fill="url(#goldGlow)"/>
    <path d="M-40 ${beam} C220 ${beam + 80} 314 ${beam - 58} 520 ${beam + 25} S916 ${beam + 88} 1340 ${beam - 16}" fill="none" stroke="#22d3ee" stroke-width="2" opacity="0.18"/>
    <path d="M-40 ${beam + 390} C240 ${beam + 260} 390 ${beam + 430} 610 ${beam + 318} S986 ${beam + 238} 1340 ${beam + 305}" fill="none" stroke="#14b8a6" stroke-width="2" opacity="0.13"/>
    ${text({ x: 112, y: 54, value: "RentalRadar", size: 24, weight: 950, fill: "#0f172a" })}
    ${text({ x: 312, y: 54, value: headline, size: 24, weight: 850, fill: "#0e7490" })}
    ${text({ x: 112, y: 666, value: subhead, size: 22, weight: 720, fill: "#334155" })}
    ${rect({ x: 878, y: 646, w: 290, h: 12, r: 6, fill: "rgba(14,116,144,0.14)" })}
    ${rect({ x: 878, y: 646, w: 290 * globalProgress, h: 12, r: 6, fill: "#0e7490" })}
    ${text({ x: 1168, y: 633, value: "47 sec overview", size: 15, weight: 800, fill: "#0f172a", anchor: "end" })}
    ${sceneBody(time)}
  </svg>`;
}

for (let frame = 0; frame < frameCount; frame += 1) {
  const name = join(frameDir, `frame-${String(frame).padStart(4, "0")}.png`);
  await sharp(Buffer.from(svgFrame(frame))).png().toFile(name);
}

await sharp(Buffer.from(svgFrame(Math.floor(fps * 18))))
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(posterPath);

const ffmpeg = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    join(frameDir, "frame-%04d.png"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-crf",
    "23",
    videoPath,
  ],
  { stdio: "inherit" },
);

rmSync(frameDir, { recursive: true, force: true });

if (ffmpeg.status !== 0) {
  process.exit(ffmpeg.status ?? 1);
}

console.log(`Generated ${videoPath} and ${posterPath}`);
