// Renders assets/activity.svg from the GitHub contribution calendar.
// Run by .github/workflows/activity.yml; needs GITHUB_TOKEN in the env.
import { writeFileSync } from "node:fs";

const USER = "VenJami";
const TITLE = "Jami's Contribution Graph";
const DAYS = 31;
const OUT = new URL("../../assets/activity.svg", import.meta.url);

const W = 900, H = 320;
const PAD = { top: 74, right: 32, bottom: 48, left: 56 };
const C = {
  bg: "#0b0e14", frame: "#1c2230", grid: "#1c2230",
  accent: "#EF9F27", point: "#ffffff", title: "#f0f6fc", label: "#6e7681",
};

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": USER,
  },
  body: JSON.stringify({ query, variables: { login: USER } }),
});
if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));

const days = data.user.contributionsCollection.contributionCalendar.weeks
  .flatMap((w) => w.contributionDays)
  .slice(-DAYS);

const total = days.reduce((sum, d) => sum + d.contributionCount, 0);
const peak = Math.max(...days.map((d) => d.contributionCount));
const step = Math.max(1, Math.ceil(peak / 4));
const yMax = step * 4;

const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;
const x = (i) => PAD.left + (i * plotW) / (days.length - 1);
const y = (v) => PAD.top + plotH - (v * plotH) / yMax;
const r = (n) => Math.round(n * 10) / 10;

const pts = days.map((d, i) => [r(x(i)), r(y(d.contributionCount))]);
const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px} ${py}`).join(" ");
const area = `${line} L${pts.at(-1)[0]} ${y(0)} L${pts[0][0]} ${y(0)} Z`;

const fmt = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const yTicks = [0, 1, 2, 3, 4].map((k) => {
  const v = k * step, py = r(y(v));
  return `<line x1="${PAD.left}" y1="${py}" x2="${W - PAD.right}" y2="${py}" stroke="${C.grid}" stroke-width="1"/>` +
    `<text x="${PAD.left - 12}" y="${py + 4}" font-size="11" text-anchor="end" fill="${C.label}">${v}</text>`;
});

// Every 5th day plus the last, skipping any that would crowd the last label.
const last = days.length - 1;
const xTicks = days
  .map((d, i) => [d, i])
  .filter(([, i]) => i === last || (i % 5 === 0 && last - i >= 3))
  .map(([d, i]) => `<text x="${r(x(i))}" y="${H - PAD.bottom + 24}" font-size="11" text-anchor="middle" fill="${C.label}">${fmt(d.date)}</text>`);

const dots = pts.map(([px, py]) => `<circle cx="${px}" cy="${py}" r="3.2" fill="${C.point}" stroke="${C.accent}" stroke-width="1.5"/>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${TITLE}: ${total} contributions in the last ${days.length} days">
  <style>text{font-family:ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace}</style>
  <defs>
    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.accent}" stop-opacity=".35"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="14" fill="${C.bg}" stroke="${C.frame}" stroke-width="2"/>
  <text x="${PAD.left - 24}" y="40" font-size="16" font-weight="700" fill="${C.title}">${TITLE}</text>
  <text x="${W - PAD.right}" y="40" font-size="12" text-anchor="end" fill="${C.label}">${total} contributions · last ${days.length} days</text>
  ${yTicks.join("\n  ")}
  <path d="${area}" fill="url(#area)"/>
  <path d="${line}" fill="none" stroke="${C.accent}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots.join("\n  ")}
  ${xTicks.join("\n  ")}
</svg>
`;

writeFileSync(OUT, svg);
console.log(`Wrote assets/activity.svg (${total} contributions, peak ${peak})`);
