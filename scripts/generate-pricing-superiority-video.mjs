import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const width = 1280;
const height = 720;
const fps = 15;
const duration = 54;
const frameCount = duration * fps;
const outputDir = "apps/web/public";
const frameDir = ".video-frames/pricing-superiority";
const audioDir = ".video-frames/pricing-superiority-audio";
const videoPath = `${outputDir}/pricing-superiority-overview.mp4`;
const posterPath = `${outputDir}/pricing-superiority-poster.jpg`;
const voicePath = `${audioDir}/voice.mp3`;

const voiceover = [
  "The next generation of vacation rental pricing is here.",
  "RentalRadar does not stop at stale feeds or generic market averages.",
  "Our AI agents run live Playwright workflows in headed Chrome, checking the same guest-visible pages travelers use.",
  "They watch comp prices, calendars, fees, availability, and booking signals as the market moves.",
  "Then RentalRadar combines that live market evidence with your real booking data, occupancy, pace, lead time, and revenue.",
  "The result is not a black box.",
  "Every recommendation explains what changed, why it matters, and what rate gives you the best chance to win the booking.",
  "Live browser intelligence plus real performance data.",
  "That is the ultimate combination.",
  "That is RentalRadar.",
].join(" ");

const scenes = [
  {
    start: 0,
    end: 7,
    eyebrow: "Next-generation pricing",
    headline: "The next generation of pricing is here.",
    subhead: "Live AI browser intelligence meets real booking performance.",
    overlay: "AI agents + real data.",
  },
  {
    start: 7,
    end: 17,
    eyebrow: "The old way",
    headline: "Stale feeds miss what guests see today.",
    subhead: "Generic market data cannot see every open night, fee, or guest-visible rate.",
    overlay: "Old averages are not enough.",
  },
  {
    start: 17,
    end: 32,
    eyebrow: "The RentalRadar difference",
    headline: "AI agents browse live with headed Chrome.",
    subhead: "Playwright workflows inspect Airbnb, VRBO, Booking.com, and direct booking pages.",
    overlay: "See exactly what travelers see.",
  },
  {
    start: 32,
    end: 43,
    eyebrow: "The ultimate combination",
    headline: "Live market evidence plus your real booking data.",
    subhead: "Occupancy, pace, lead time, revenue, comps, and availability work together.",
    overlay: "Browser intelligence + performance data.",
  },
  {
    start: 43,
    end: 50,
    eyebrow: "The decision layer",
    headline: "Every price comes with a clear AI explanation.",
    subhead: "Know what changed, why it matters, and where the rate should move.",
    overlay: "No black box decisions.",
  },
  {
    start: 50,
    end: 54,
    eyebrow: "RentalRadar.ai",
    headline: "Live browser intelligence. Real data. Better rates.",
    subhead: "The next generation of pricing is here.",
    overlay: "That is RentalRadar.",
  },
];

const liveChecks = [
  ["Airbnb", "4BR beach house", "$486", "guest-visible total live", "#be123c"],
  ["VRBO", "Oceanfront villa", "$522", "calendar and fees live", "#0f766e"],
  ["Booking.com", "Resort suite", "$438", "availability live", "#1d4ed8"],
  ["Direct site", "Brand.com checkout", "$469", "booking funnel live", "#b45309"],
];

mkdirSync(outputDir, { recursive: true });
rmSync(frameDir, { recursive: true, force: true });
rmSync(audioDir, { recursive: true, force: true });
mkdirSync(frameDir, { recursive: true });
mkdirSync(audioDir, { recursive: true });

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const pulse = (time, speed = 1) => (Math.sin(time * Math.PI * 2 * speed) + 1) / 2;
const progress = (time, start, end) => clamp((time - start) / (end - start));
const sceneAlpha = (time, start, end, fade = 0.55) =>
  clamp(Math.min(progress(time, start, start + fade), progress(time, end, end - fade)));
const xml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const envValue = (...names) => names.map((name) => process.env[name]).find((value) => value && value.trim());

async function resolveElevenLabsVoiceId(apiKey, baseUrl) {
  const explicitVoiceId = envValue("ELEVENLABS_VOICE_ID", "ELEVEN_VOICE_ID", "XI_VOICE_ID");

  if (explicitVoiceId) {
    return explicitVoiceId.trim();
  }

  const voicesResponse = await fetch(`${baseUrl}/voices`, {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!voicesResponse.ok) {
    throw new Error(`ElevenLabs voices request failed with ${voicesResponse.status}`);
  }

  const voicesData = await voicesResponse.json();
  const voices = Array.isArray(voicesData?.voices) ? voicesData.voices : [];
  const preferredVoice = voices.find((voice) => /adam|brian|chris|daniel|drew|george|josh/i.test(voice.name ?? "")) ?? voices[0];

  if (!preferredVoice?.voice_id) {
    throw new Error("ElevenLabs API key is present, but no voice ID was configured or returned by /voices.");
  }

  console.log(`Using ElevenLabs voice: ${preferredVoice.name ?? "configured account voice"}`);
  return preferredVoice.voice_id;
}

async function generateElevenLabsVoiceover() {
  const apiKey = envValue("ELEVENLABS_API_KEY", "ELEVEN_API_KEY", "XI_API_KEY");

  if (!apiKey) {
    return false;
  }

  const baseUrl = envValue("ELEVENLABS_BASE_URL", "ELEVEN_BASE_URL")?.replace(/\/$/, "") ?? "https://api.elevenlabs.io/v1";
  const modelId = envValue("ELEVENLABS_MODEL_ID", "ELEVEN_MODEL_ID") ?? "eleven_multilingual_v2";
  const voiceId = await resolveElevenLabsVoiceId(apiKey.trim(), baseUrl);
  const endpoint = `${baseUrl}/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  console.log("Generating ElevenLabs voiceover from Railway environment variables.");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": apiKey.trim(),
    },
    body: JSON.stringify({
      text: voiceover,
      model_id: modelId,
      voice_settings: {
        stability: 0.48,
        similarity_boost: 0.78,
        style: 0.28,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs voiceover request failed with ${response.status}: ${detail.slice(0, 240)}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  await writeFile(voicePath, audio);
  return true;
}

function text({ x, y, value, size = 32, weight = 700, fill = "#f8fafc", anchor = "start", opacity = 1, family = "Inter, Arial, sans-serif" }) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${xml(value)}</text>`;
}

function multiline({ x, y, lines, size = 42, weight = 800, fill = "#0f172a", lineHeight = 1.14, anchor = "start", opacity = 1 }) {
  return lines
    .map((line, index) =>
      text({ x, y: y + index * size * lineHeight, value: line, size, weight, fill, anchor, opacity }),
    )
    .join("");
}

function rect({ x, y, w, h, r = 16, fill = "none", stroke = "none", sw = 1, opacity = 1, filter = "" }) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" ${filter ? `filter="${filter}"` : ""}/>`;
}

function cursor(x, y, opacity = 1) {
  return `
    <g transform="translate(${x} ${y})" opacity="${opacity}">
      <path d="M0 0 L0 30 L9 23 L15 38 L23 35 L16 20 L28 20 Z" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>
      <circle cx="8" cy="7" r="18" fill="none" stroke="#22d3ee" stroke-width="2" opacity="0.32"/>
    </g>`;
}

function browserShell(time, address, body, opacity = 1) {
  return `
    <g opacity="${opacity}">
      ${rect({ x: 98, y: 118, w: 1084, h: 456, r: 30, fill: "#ffffff", stroke: "rgba(14,116,144,0.22)", sw: 2, filter: "url(#softShadow)" })}
      <path d="M128 118 H1152 A30 30 0 0 1 1182 148 V190 H98 V148 A30 30 0 0 1 128 118 Z" fill="#eef8fb"/>
      <circle cx="142" cy="153" r="8" fill="#fb7185"/>
      <circle cx="169" cy="153" r="8" fill="#fbbf24"/>
      <circle cx="196" cy="153" r="8" fill="#34d399"/>
      ${rect({ x: 236, y: 134, w: 560, h: 38, r: 19, fill: "#ffffff", stroke: "rgba(14,116,144,0.18)" })}
      ${text({ x: 266, y: 159, value: address, size: 16, weight: 700, fill: "#334155" })}
      <circle cx="1034" cy="153" r="18" fill="#22d3ee" opacity="${0.12 + 0.12 * pulse(time, 0.5)}"/>
      ${text({ x: 926, y: 159, value: "live market check", size: 15, weight: 800, fill: "#0e7490" })}
      <clipPath id="browserBodyClip"><rect x="98" y="190" width="1084" height="384" rx="0"/></clipPath>
      <g clip-path="url(#browserBodyClip)">${body}</g>
    </g>`;
}

function oldDataScene(time, alpha) {
  const p = ease(progress(time, 0, 7));
  const orbit = 188 + 8 * pulse(time, 0.35);
  return browserShell(
    time,
    "rentalradar.ai/next-generation-pricing",
    `
      ${rect({ x: 98, y: 190, w: 1084, h: 384, r: 0, fill: "#f8fafc" })}
      ${rect({ x: 146, y: 236, w: 438, h: 284, r: 30, fill: "#0f172a", stroke: "rgba(103,232,249,0.28)", sw: 2 })}
      ${text({ x: 184, y: 294, value: "AI pricing agent", size: 36, weight: 950, fill: "#e0f2fe" })}
      ${text({ x: 184, y: 340, value: "Playwright + headed Chrome", size: 22, weight: 850, fill: "#67e8f9" })}
      ${text({ x: 184, y: 382, value: "live comps, fees, calendars", size: 22, weight: 760, fill: "#cbd5e1" })}
      ${text({ x: 184, y: 420, value: "your bookings and revenue", size: 22, weight: 760, fill: "#cbd5e1" })}
      ${rect({ x: 184, y: 456, w: 228, h: 42, r: 21, fill: "#67e8f9", stroke: "none" })}
      ${text({ x: 298, y: 483, value: "ULTIMATE COMBINATION", size: 14, weight: 950, fill: "#082f49", anchor: "middle" })}
      <g transform="translate(842 360)">
        <circle cx="0" cy="0" r="${orbit}" fill="none" stroke="#22d3ee" stroke-width="2" opacity="0.16"/>
        <circle cx="0" cy="0" r="${130 + 10 * p}" fill="#ecfeff" stroke="#22d3ee" stroke-width="3" opacity="0.9"/>
        <path d="M-58 14 C-22 -44 40 -44 68 12 C38 58 -24 60 -58 14Z" fill="#ffffff" stroke="#0e7490" stroke-width="5"/>
        <circle cx="5" cy="11" r="32" fill="#22d3ee" opacity="0.25"/>
        <circle cx="5" cy="11" r="13" fill="#0f172a"/>
        ${text({ x: 0, y: 182, value: "See the market live", size: 23, weight: 950, fill: "#0f172a", anchor: "middle" })}
      </g>
    `,
    alpha,
  );
}

function staleApiScene(time, alpha) {
  const cards = ["Yesterday's rates", "Missing open nights", "No guest view"].map((label, index) => {
    const y = 250 + index * 80;
    const active = pulse(time + index * 0.2, 0.45) > 0.55;
    return `
      <g transform="translate(150 ${y})">
        ${rect({ x: 0, y: 0, w: 380, h: 58, r: 18, fill: active ? "#fee2e2" : "#ffffff", stroke: active ? "#fb7185" : "rgba(15,23,42,0.1)", sw: active ? 2 : 1 })}
        <circle cx="30" cy="29" r="11" fill="${active ? "#fb7185" : "#cbd5e1"}"/>
        ${text({ x: 58, y: 36, value: label, size: 23, weight: 850, fill: "#0f172a" })}
      </g>`;
  }).join("");
  return browserShell(
    time,
    "market-feed.example/data",
    `
      ${rect({ x: 98, y: 190, w: 1084, h: 384, r: 0, fill: "#f8fafc" })}
      ${cards}
      ${rect({ x: 630, y: 245, w: 406, h: 228, r: 28, fill: "#0f172a", stroke: "rgba(103,232,249,0.26)", sw: 2 })}
      ${text({ x: 834, y: 296, value: "Guest-visible reality", size: 27, weight: 920, fill: "#e0f2fe", anchor: "middle" })}
      ${text({ x: 834, y: 344, value: "fees, open nights,", size: 24, weight: 760, fill: "#94a3b8", anchor: "middle" })}
      ${text({ x: 834, y: 380, value: "and last-minute moves", size: 24, weight: 760, fill: "#94a3b8", anchor: "middle" })}
      ${text({ x: 834, y: 428, value: "missed by stale feeds", size: 29, weight: 950, fill: "#fef3c7", anchor: "middle" })}
    `,
    alpha,
  );
}

function liveResearchScene(time, alpha) {
  const scan = (time - 22) % 4;
  const rows = liveChecks
    .map(([name, property, price, note, color], index) => {
      const x = 144 + (index % 2) * 494;
      const y = 244 + Math.floor(index / 2) * 136;
      const active = Math.floor(scan) === index || pulse(time + index * 0.33, 0.6) > 0.68;
      return `
        <g transform="translate(${x} ${y})">
          ${rect({ x: 0, y: 0, w: 432, h: 104, r: 22, fill: active ? "#ecfeff" : "#ffffff", stroke: active ? "#22d3ee" : "rgba(14,116,144,0.14)", sw: active ? 2.4 : 1.4 })}
          <circle cx="40" cy="38" r="18" fill="${color}" opacity="0.18"/>
          ${text({ x: 70, y: 36, value: name, size: 23, weight: 950, fill: "#0f172a" })}
          ${text({ x: 70, y: 64, value: property, size: 16, weight: 720, fill: "#64748b" })}
          ${text({ x: 352, y: 50, value: price, size: 30, weight: 950, fill: color, anchor: "middle" })}
          ${text({ x: 70, y: 88, value: note, size: 14, weight: 760, fill: "#0e7490" })}
        </g>`;
    })
    .join("");
  const cursorX = lerp(170, 1030, ease(progress((time - 22) % 6, 0, 6)));
  const cursorY = 328 + Math.sin((time - 22) * 1.6) * 112;
  return browserShell(
    time,
    "airbnb.com  vrbo.com  booking.com  direct-site.com",
    `
      ${rect({ x: 98, y: 190, w: 1084, h: 384, r: 0, fill: "#f8fafc" })}
      ${rect({ x: 150, y: 208, w: 246, h: 32, r: 16, fill: "#ecfeff", stroke: "rgba(14,116,144,0.18)" })}
      ${text({ x: 273, y: 230, value: "Playwright headed Chrome", size: 14, weight: 900, fill: "#0e7490", anchor: "middle" })}
      ${rect({ x: 418, y: 208, w: 188, h: 32, r: 16, fill: "#f0fdf4", stroke: "rgba(20,184,166,0.18)" })}
      ${text({ x: 512, y: 230, value: "AI agent run", size: 14, weight: 900, fill: "#0f766e", anchor: "middle" })}
      ${rows}
      ${cursor(cursorX, cursorY, 1)}
    `,
    alpha,
  );
}

function combineScene(time, alpha) {
  const bars = [118, 176, 146, 214, 198, 252, 226];
  const barSvg = bars
    .map((bar, index) => {
      const h = bar * (0.74 + 0.26 * ease(progress(time, 27 + index * 0.25, 31 + index * 0.25)));
      const x = 186 + index * 50;
      return rect({ x, y: 490 - h, w: 30, h, r: 8, fill: index > 4 ? "#14b8a6" : "#22d3ee", opacity: 0.86 });
    })
    .join("");
  return browserShell(
    time,
    "rentalradar.ai/your-bookings",
    `
      ${rect({ x: 98, y: 190, w: 1084, h: 384, r: 0, fill: "#f8fafc" })}
      ${rect({ x: 150, y: 240, w: 428, h: 292, r: 26, fill: "#ffffff", stroke: "rgba(14,116,144,0.16)" })}
      ${text({ x: 184, y: 286, value: "Your real bookings", size: 32, weight: 950, fill: "#0f172a" })}
      ${barSvg}
      ${text({ x: 184, y: 530, value: "occupancy, booking pace, and revenue", size: 16, weight: 760, fill: "#64748b" })}
      ${rect({ x: 660, y: 240, w: 392, h: 292, r: 26, fill: "#0f172a", stroke: "rgba(103,232,249,0.3)", sw: 2 })}
      ${text({ x: 856, y: 290, value: "Live market evidence", size: 27, weight: 950, fill: "#e0f2fe", anchor: "middle" })}
      ${text({ x: 856, y: 340, value: "+", size: 42, weight: 950, fill: "#67e8f9", anchor: "middle" })}
      ${text({ x: 856, y: 388, value: "Real booking data", size: 27, weight: 950, fill: "#e0f2fe", anchor: "middle" })}
      ${rect({ x: 736, y: 428, w: 240, h: 50, r: 25, fill: "#fef3c7", stroke: "none" })}
      ${text({ x: 856, y: 460, value: "better rate decision", size: 21, weight: 950, fill: "#78350f", anchor: "middle" })}
    `,
    alpha,
  );
}

function recommendationScene(time, alpha) {
  const rows = [
    ["Fri", "$312", "raise"],
    ["Sat", "$329", "raise"],
    ["Sun", "$246", "fill gap"],
    ["Mon", "$218", "hold"],
  ];
  const rowSvg = rows
    .map(([day, price, action], index) => {
      const active = pulse(time + index * 0.15, 0.5) > 0.48;
      return `
        <g transform="translate(168 ${252 + index * 68})">
          ${rect({ x: 0, y: 0, w: 468, h: 52, r: 16, fill: active ? "#ecfeff" : "#ffffff", stroke: active ? "#22d3ee" : "rgba(14,116,144,0.13)", sw: active ? 2 : 1 })}
          ${text({ x: 24, y: 34, value: day, size: 22, weight: 850, fill: "#475569" })}
          ${text({ x: 210, y: 34, value: price, size: 25, weight: 950, fill: "#0f172a", anchor: "middle" })}
          ${text({ x: 390, y: 34, value: action, size: 18, weight: 850, fill: "#0e7490", anchor: "middle" })}
        </g>`;
    })
    .join("");
  return browserShell(
    time,
    "rentalradar.ai/recommendations",
    `
      ${rect({ x: 98, y: 190, w: 1084, h: 384, r: 0, fill: "#f8fafc" })}
      ${text({ x: 150, y: 226, value: "Clear recommendations", size: 32, weight: 950, fill: "#0f172a" })}
      ${rowSvg}
      ${rect({ x: 710, y: 250, w: 342, h: 230, r: 26, fill: "#f0fdf4", stroke: "rgba(20,184,166,0.28)", sw: 2 })}
      ${text({ x: 881, y: 305, value: "LLM decision layer", size: 29, weight: 950, fill: "#0f172a", anchor: "middle" })}
      ${text({ x: 881, y: 350, value: "3 comps dropped rates", size: 19, weight: 800, fill: "#475569", anchor: "middle" })}
      ${text({ x: 881, y: 384, value: "booking pace is behind", size: 19, weight: 800, fill: "#475569", anchor: "middle" })}
      ${text({ x: 881, y: 430, value: "move Sunday to $246", size: 27, weight: 950, fill: "#0f766e", anchor: "middle" })}
    `,
    alpha,
  );
}

function finalScene(time, alpha) {
  return `
    <g opacity="${alpha}">
      <rect width="${width}" height="${height}" fill="#050816"/>
      <circle cx="640" cy="350" r="${170 + 14 * pulse(time, 0.45)}" fill="none" stroke="#22d3ee" stroke-width="2" opacity="0.24"/>
      <circle cx="640" cy="350" r="${250 + 18 * pulse(time, 0.35)}" fill="none" stroke="#14b8a6" stroke-width="2" opacity="0.14"/>
      ${text({ x: 640, y: 214, value: "RentalRadar.ai", size: 44, weight: 950, fill: "#e0f2fe", anchor: "middle" })}
      ${multiline({
        x: 640,
        y: 314,
        anchor: "middle",
        lines: ["Smarter pricing.", "Higher revenue.", "Zero guesswork."],
        size: 50,
        weight: 950,
        fill: "#ffffff",
        lineHeight: 1.16,
      })}
      ${rect({ x: 474, y: 530, w: 332, h: 54, r: 27, fill: "#67e8f9", stroke: "none" })}
      ${text({ x: 640, y: 565, value: "Start free - no credit card", size: 20, weight: 900, fill: "#082f49", anchor: "middle" })}
    </g>`;
}

function titleOverlay(time) {
  const scene = scenes.find((entry) => time >= entry.start && time < entry.end) ?? scenes.at(-1);
  const alpha = sceneAlpha(time, scene.start, scene.end, 0.4);
  return `
    <g opacity="${alpha}">
      ${rect({ x: 74, y: 36, w: 1132, h: 58, r: 29, fill: "rgba(255,255,255,0.78)", stroke: "rgba(14,116,144,0.18)", sw: 1 })}
      ${text({ x: 110, y: 72, value: scene.eyebrow, size: 17, weight: 900, fill: "#0e7490" })}
      ${text({ x: 1170, y: 72, value: `${Math.floor(time + 1)} / ${duration} sec`, size: 15, weight: 760, fill: "#64748b", anchor: "end" })}
    </g>`;
}

function sceneContent(time) {
  const a1 = sceneAlpha(time, 0, 7);
  const a2 = sceneAlpha(time, 7, 17);
  const a3 = sceneAlpha(time, 17, 32);
  const a4 = sceneAlpha(time, 43, 50);
  const a5 = sceneAlpha(time, 50, 54);

  return `
    ${oldDataScene(time, a1)}
    ${staleApiScene(time, a2)}
    ${liveResearchScene(time, a3)}
    ${combineScene(time, sceneAlpha(time, 32, 43))}
    ${recommendationScene(time, a4)}
    ${finalScene(time, a5)}
  `;
}

function lowerThird(time) {
  const scene = scenes.find((entry) => time >= entry.start && time < entry.end) ?? scenes.at(-1);
  const alpha = sceneAlpha(time, scene.start, scene.end, 0.4);
  const lines = wrapLines(scene.headline, 50);
  return `
    <g opacity="${alpha}">
      ${rect({ x: 74, y: 604, w: 1132, h: 82, r: 24, fill: "rgba(15,23,42,0.88)", stroke: "rgba(103,232,249,0.22)", sw: 1.4 })}
      ${multiline({ x: 110, y: 636, lines, size: lines.length > 1 ? 23 : 27, weight: 920, fill: "#ffffff", lineHeight: 1.05 })}
      ${text({ x: 110, y: 670, value: scene.overlay, size: 17, weight: 760, fill: "#a7f3ff" })}
    </g>`;
}

function svgFrame(frame) {
  const time = frame / fps;
  const beam = 92 + Math.sin(time * 0.65) * 34;

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
        <stop offset="0" stop-color="#67e8f9" stop-opacity="0.44"/>
        <stop offset="1" stop-color="#67e8f9" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="goldGlow" cx="84%" cy="78%" r="52%">
        <stop offset="0" stop-color="#fbbf24" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#fbbf24" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect width="${width}" height="${height}" fill="url(#cyanGlow)"/>
    <rect width="${width}" height="${height}" fill="url(#goldGlow)"/>
    <path d="M-40 ${beam} C220 ${beam + 80} 314 ${beam - 58} 520 ${beam + 25} S916 ${beam + 88} 1340 ${beam - 16}" fill="none" stroke="#22d3ee" stroke-width="2" opacity="0.18"/>
    <path d="M-40 ${beam + 408} C240 ${beam + 268} 390 ${beam + 430} 610 ${beam + 318} S986 ${beam + 238} 1340 ${beam + 305}" fill="none" stroke="#14b8a6" stroke-width="2" opacity="0.13"/>
    ${titleOverlay(time)}
    ${sceneContent(time)}
    ${lowerThird(time)}
  </svg>`;
}

function wrapLines(value, maxLength = 52) {
  return value.split(" ").reduce(
    (lines, word) => {
      const current = lines.at(-1) ?? "";
      if (!current) {
        lines[lines.length - 1] = word;
        return lines;
      }
      if (`${current} ${word}`.length > maxLength) {
        lines.push(word);
        return lines;
      }
      lines[lines.length - 1] = `${current} ${word}`;
      return lines;
    },
    [""],
  );
}

for (let frame = 0; frame < frameCount; frame += 1) {
  const name = join(frameDir, `frame-${String(frame).padStart(4, "0")}.png`);
  await sharp(Buffer.from(svgFrame(frame))).png().toFile(name);
}

await sharp(Buffer.from(svgFrame(Math.floor(fps * 2.2))))
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(posterPath);

let voiceDuration = duration;
let voiceFilter = "anull";
let voiceInput = ["-f", "lavfi", "-t", String(duration), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
const hasElevenLabsVoiceover = await generateElevenLabsVoiceover();

if (!hasElevenLabsVoiceover) {
  const sayAvailable = spawnSync("which", ["say"], { encoding: "utf8" }).status === 0;

  if (sayAvailable) {
    const localVoicePath = `${audioDir}/voice.aiff`;
    console.warn("ELEVENLABS_API_KEY was not found. Falling back to local macOS voice for development.");
    const say = spawnSync("say", ["-v", "Alex", "-r", "150", "-o", localVoicePath, voiceover], {
      stdio: "inherit",
    });

    if (say.status !== 0) {
      process.exit(say.status ?? 1);
    }

    await import("node:fs/promises").then(({ rename }) => rename(localVoicePath, voicePath));
  } else {
    console.warn("No ElevenLabs API key or macOS 'say' command found. Generating the video with music only.");
  }
}

if (hasElevenLabsVoiceover || spawnSync("test", ["-f", voicePath]).status === 0) {
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", voicePath],
    { encoding: "utf8" },
  );
  voiceDuration = Number.parseFloat(probe.stdout.trim()) || duration;
  const tempo = clamp(voiceDuration / duration, 0.5, 2);
  voiceFilter = `atempo=${tempo.toFixed(6)},apad,atrim=0:${duration}`;
  voiceInput = ["-i", voicePath];
}

const ffmpeg = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    join(frameDir, "frame-%04d.png"),
    ...voiceInput,
    "-f",
    "lavfi",
    "-t",
    String(duration),
    "-i",
    "sine=frequency=164.81:sample_rate=44100",
    "-f",
    "lavfi",
    "-t",
    String(duration),
    "-i",
    "sine=frequency=246.94:sample_rate=44100",
    "-f",
    "lavfi",
    "-t",
    String(duration),
    "-i",
    "sine=frequency=329.63:sample_rate=44100",
    "-filter_complex",
    `[1:a]${voiceFilter},volume=1.35[voice];[2:a]volume=0.010,afade=t=in:st=0:d=1.2,afade=t=out:st=${duration - 2.5}:d=2.5[m1];[3:a]volume=0.005,afade=t=in:st=0:d=1.2,afade=t=out:st=${duration - 2.5}:d=2.5[m2];[4:a]volume=0.003,afade=t=in:st=0:d=1.2,afade=t=out:st=${duration - 2.5}:d=2.5[m3];[voice][m1][m2][m3]amix=inputs=4:duration=longest,atrim=0:${duration}[a]`,
    "-map",
    "0:v:0",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-crf",
    "22",
    videoPath,
  ],
  { stdio: "inherit" },
);

rmSync(frameDir, { recursive: true, force: true });
rmSync(audioDir, { recursive: true, force: true });

if (ffmpeg.status !== 0) {
  process.exit(ffmpeg.status ?? 1);
}

const storyboardPath = `${outputDir}/pricing-superiority-storyboard.txt`;
const storyboard = `RentalRadar.ai ${duration}-second explainer

Voiceover voice:
ElevenLabs text-to-speech. Warm, friendly, confident American narrator. Conversational, trustworthy, clear, positive, and helpful.

Full voiceover script:
${voiceover}

Storyboard:
0-7 sec - Next-generation pricing
Visual: RentalRadar AI pricing agent panel beside an animated live-market eye and radar rings.
On-screen text: The next generation of pricing is here. / AI agents + real data.

7-17 sec - Problem with stale tools
Visual: Stale-feed cards for yesterday's rates, missing open nights, and no guest view beside a dark guest-visible reality panel.
On-screen text: Stale feeds miss what guests see today. / Old averages are not enough.

17-32 sec - RentalRadar difference
Visual: Playwright headed Chrome and AI agent badges above four live check cards for Airbnb, VRBO, Booking.com, and a direct booking site.
On-screen text: AI agents browse live with headed Chrome. / See exactly what travelers see.

32-43 sec - Ultimate combination
Visual: Your real bookings and revenue bars combine with live guest-market evidence into a better rate decision.
On-screen text: Live market evidence plus your real booking data. / Browser intelligence + performance data.

43-50 sec - LLM decision layer
Visual: Daily recommendation rows show raise, hold, and fill-gap moves with an LLM explanation card.
On-screen text: Every price comes with a clear AI explanation. / No black box decisions.

50-54 sec - Close
Visual: RentalRadar.ai end card with radar rings and a Start free call to action.
On-screen text: Live browser intelligence. Real data. Better rates. / That is RentalRadar.

Background music:
Upbeat, modern, clean, light electronic pulse under the voice. Friendly momentum, not corporate, and quiet enough that the voice stays primary.
`;

rmSync(storyboardPath, { force: true });
await writeFile(storyboardPath, storyboard);

console.log(`Generated ${videoPath}, ${posterPath}, and ${storyboardPath}`);
console.log(`Voiceover source duration: ${voiceDuration.toFixed(2)}s, final video duration: ${duration}s`);
