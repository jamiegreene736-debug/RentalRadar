import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const width = 1280;
const height = 720;
const fps = 15;
const duration = 47;
const frameCount = duration * fps;
const outputDir = "apps/web/public";
const frameDir = ".video-frames/pricing-superiority";
const audioDir = ".video-frames/pricing-superiority-audio";
const videoPath = `${outputDir}/pricing-superiority-overview.mp4`;
const posterPath = `${outputDir}/pricing-superiority-poster.jpg`;
const voicePath = `${audioDir}/voice.aiff`;

const voiceover = [
  "Most pricing tools are guessing with old data.",
  "Here's why RentalRadar gets it right every single time.",
  "Other tools rely on stale APIs and limited information.",
  "They don't see what guests are actually seeing today.",
  "RentalRadar uses an army of AI agents that do the manual research for you.",
  "They check every listing live, exactly the way a guest sees it right now,",
  "and combine it with your real bookings and revenue data.",
  "So you get clear, trustworthy pricing recommendations that actually make you more money",
  "with way less guesswork.",
  "Smarter pricing. Higher revenue. Zero guesswork. That's RentalRadar.",
].join(" ");

const scenes = [
  {
    start: 0,
    end: 8,
    eyebrow: "The old way",
    headline: "Most pricing tools are guessing with old data.",
    subhead: "RentalRadar checks what guests see right now.",
    overlay: "Old data in. Stale guess out.",
  },
  {
    start: 8,
    end: 22,
    eyebrow: "The problem",
    headline: "Other tools miss what guests are actually seeing today.",
    subhead: "Limited feeds cannot see every live listing, open night, or guest-visible price.",
    overlay: "Stale feeds miss today's market.",
  },
  {
    start: 22,
    end: 35,
    eyebrow: "The RentalRadar difference",
    headline: "An army of AI agents does the manual research for you.",
    subhead: "They check Airbnb, VRBO, Booking.com, and comp properties live.",
    overlay: "Live guest prices + your real bookings.",
  },
  {
    start: 35,
    end: 43,
    eyebrow: "The result",
    headline: "Clear pricing recommendations you can actually trust.",
    subhead: "Make more money with far less guesswork.",
    overlay: "Know why every price changed.",
  },
  {
    start: 43,
    end: 47,
    eyebrow: "RentalRadar.ai",
    headline: "Smarter pricing. Higher revenue. Zero guesswork.",
    subhead: "That's RentalRadar.",
    overlay: "Start free. No credit card.",
  },
];

const liveChecks = [
  ["VRBO", "Oceanfront villa", "$318", "calendar open live", "#0f766e"],
  ["Airbnb", "Downtown loft", "$286", "guest rate live", "#be123c"],
  ["Booking.com", "Resort suite", "$301", "availability live", "#1d4ed8"],
  ["Your PM Website", "Direct booking", "$274", "checkout page live", "#b45309"],
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
  const p = ease(progress(time, 0, 8));
  const needle = lerp(-45, 16, p);
  return browserShell(
    time,
    "old-data-pricing-tool.example",
    `
      ${rect({ x: 98, y: 190, w: 1084, h: 384, r: 0, fill: "#f8fafc" })}
      ${rect({ x: 150, y: 242, w: 418, h: 230, r: 26, fill: "#fff7ed", stroke: "rgba(180,83,9,0.24)", sw: 2 })}
      ${text({ x: 184, y: 292, value: "Old data", size: 42, weight: 950, fill: "#9a3412" })}
      ${text({ x: 184, y: 340, value: "limited info", size: 28, weight: 760, fill: "#b45309" })}
      ${text({ x: 184, y: 388, value: "best guess", size: 28, weight: 760, fill: "#b45309" })}
      <g transform="translate(796 358)">
        <circle cx="0" cy="0" r="104" fill="#ecfeff" stroke="#22d3ee" stroke-width="3" opacity="0.82"/>
        <path d="M-70 40 A82 82 0 0 1 70 40" fill="none" stroke="#0e7490" stroke-width="8" stroke-linecap="round" opacity="0.35"/>
        <path d="M0 0 L${Math.cos((needle - 90) * Math.PI / 180) * 76} ${Math.sin((needle - 90) * Math.PI / 180) * 76}" stroke="#f59e0b" stroke-width="8" stroke-linecap="round"/>
        <circle cx="0" cy="0" r="10" fill="#0f172a"/>
        ${text({ x: 0, y: 148, value: "RentalRadar checks live instead", size: 22, weight: 900, fill: "#0f172a", anchor: "middle" })}
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
      ${text({ x: 834, y: 300, value: "What guests see today?", size: 28, weight: 920, fill: "#e0f2fe", anchor: "middle" })}
      ${text({ x: 834, y: 356, value: "Other tools often", size: 23, weight: 700, fill: "#94a3b8", anchor: "middle" })}
      ${text({ x: 834, y: 392, value: "cannot see it.", size: 34, weight: 950, fill: "#fef3c7", anchor: "middle" })}
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
      ${text({ x: 856, y: 296, value: "Live guest prices", size: 28, weight: 950, fill: "#e0f2fe", anchor: "middle" })}
      ${text({ x: 856, y: 352, value: "+", size: 46, weight: 950, fill: "#67e8f9", anchor: "middle" })}
      ${text({ x: 856, y: 406, value: "Your booking numbers", size: 28, weight: 950, fill: "#e0f2fe", anchor: "middle" })}
      ${text({ x: 856, y: 470, value: "smarter price", size: 34, weight: 950, fill: "#fef3c7", anchor: "middle" })}
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
      ${rect({ x: 710, y: 264, w: 342, h: 202, r: 26, fill: "#f0fdf4", stroke: "rgba(20,184,166,0.28)", sw: 2 })}
      ${text({ x: 881, y: 326, value: "Trust the price", size: 31, weight: 950, fill: "#0f172a", anchor: "middle" })}
      ${text({ x: 881, y: 374, value: "because you can see", size: 22, weight: 760, fill: "#475569", anchor: "middle" })}
      ${text({ x: 881, y: 410, value: "why it changed.", size: 30, weight: 950, fill: "#0f766e", anchor: "middle" })}
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
      ${text({ x: 1170, y: 72, value: `${Math.floor(time + 1)} / 47 sec`, size: 15, weight: 760, fill: "#64748b", anchor: "end" })}
    </g>`;
}

function sceneContent(time) {
  const a1 = sceneAlpha(time, 0, 8);
  const a2 = sceneAlpha(time, 8, 22);
  const a3 = sceneAlpha(time, 22, 35);
  const a4 = sceneAlpha(time, 35, 43);
  const a5 = sceneAlpha(time, 43, 47);

  return `
    ${oldDataScene(time, a1)}
    ${staleApiScene(time, a2)}
    ${liveResearchScene(time, a3)}
    ${combineScene(time, sceneAlpha(time, 29, 35))}
    ${recommendationScene(time, a4)}
    ${finalScene(time, a5)}
  `;
}

function lowerThird(time) {
  const scene = scenes.find((entry) => time >= entry.start && time < entry.end) ?? scenes.at(-1);
  const alpha = sceneAlpha(time, scene.start, scene.end, 0.4);
  const lines = scene.headline.length > 52
    ? scene.headline.replace(" with ", " with|").split("|")
    : [scene.headline];
  return `
    <g opacity="${alpha}">
      ${rect({ x: 74, y: 604, w: 1132, h: 82, r: 24, fill: "rgba(15,23,42,0.88)", stroke: "rgba(103,232,249,0.22)", sw: 1.4 })}
      ${multiline({ x: 110, y: 636, lines, size: lines.length > 1 ? 24 : 27, weight: 920, fill: "#ffffff", lineHeight: 1.05 })}
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

for (let frame = 0; frame < frameCount; frame += 1) {
  const name = join(frameDir, `frame-${String(frame).padStart(4, "0")}.png`);
  await sharp(Buffer.from(svgFrame(frame))).png().toFile(name);
}

await sharp(Buffer.from(svgFrame(Math.floor(fps * 2.2))))
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(posterPath);

const sayAvailable = spawnSync("which", ["say"], { encoding: "utf8" }).status === 0;
let voiceDuration = duration;
let voiceFilter = "anull";
let voiceInput = ["-f", "lavfi", "-t", String(duration), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];

if (sayAvailable) {
  const say = spawnSync("say", ["-v", "Alex", "-r", "150", "-o", voicePath, voiceover], {
    stdio: "inherit",
  });

  if (say.status !== 0) {
    process.exit(say.status ?? 1);
  }

  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", voicePath],
    { encoding: "utf8" },
  );
  voiceDuration = Number.parseFloat(probe.stdout.trim()) || duration;
  const tempo = clamp(voiceDuration / duration, 0.5, 2);
  voiceFilter = `atempo=${tempo.toFixed(6)},apad,atrim=0:${duration}`;
  voiceInput = ["-i", voicePath];
} else {
  console.warn("macOS 'say' command not found. Generating the video with music only.");
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
    `[1:a]${voiceFilter},volume=1.45[voice];[2:a]volume=0.012,afade=t=in:st=0:d=1.2,afade=t=out:st=44.5:d=2.5[m1];[3:a]volume=0.006,afade=t=in:st=0:d=1.2,afade=t=out:st=44.5:d=2.5[m2];[4:a]volume=0.004,afade=t=in:st=0:d=1.2,afade=t=out:st=44.5:d=2.5[m3];[voice][m1][m2][m3]amix=inputs=4:duration=longest,atrim=0:${duration}[a]`,
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
const storyboard = `RentalRadar.ai 47-second explainer

Voiceover voice:
Warm, friendly, confident American male, age 35-42. Conversational, trustworthy, clear, positive, and helpful.

Full voiceover script:
${voiceover}

Storyboard:
0-8 sec - Hook
Visual: Old pricing dashboard, stale-data cards, and a guess meter moving from old data to RentalRadar live checks.
On-screen text: Most pricing tools are guessing with old data. / Old data in. Stale guess out.

8-22 sec - Problem with other tools
Visual: Cards for yesterday's rates, missing open nights, and no guest view beside a dark panel asking what guests see today.
On-screen text: Other tools miss what guests are actually seeing today. / Stale feeds miss today's market.

22-35 sec - RentalRadar difference
Visual: Four live check cards for VRBO, Airbnb, Booking.com, and Your PM Website with a cursor clicking through live prices.
On-screen text: An army of AI agents does the manual research for you. / Live guest prices + your real bookings.

29-35 sec - Booking data blend
Visual: Your booking bars combine with live guest prices to create a smarter price.
On-screen text: Live guest prices + your booking numbers = smarter price.

35-43 sec - Benefit
Visual: Daily recommendation rows show raise, hold, and fill-gap moves with a friendly explanation card.
On-screen text: Clear pricing recommendations you can actually trust. / Know why every price changed.

43-47 sec - Close
Visual: RentalRadar.ai end card with radar rings and a Start free call to action.
On-screen text: Smarter pricing. Higher revenue. Zero guesswork. / Start free - no credit card.

Background music:
Upbeat, modern, clean, light electronic pulse under the voice. Friendly momentum, not corporate, and quiet enough that the voice stays primary.
`;

rmSync(storyboardPath, { force: true });
await import("node:fs/promises").then(({ writeFile }) => writeFile(storyboardPath, storyboard));

console.log(`Generated ${videoPath}, ${posterPath}, and ${storyboardPath}`);
console.log(`Voiceover source duration: ${voiceDuration.toFixed(2)}s, final video duration: ${duration}s`);
