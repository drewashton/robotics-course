// How the internal portal's landing page is laid out: the heading text, the
// buttons under it, and the boxes with the sections inside each one. It is
// stored as one small piece of JSON in the portal_settings table and edited
// from "Portal layout" in the Admin Panel. Until it is first saved, the
// defaults below are used, so nothing has to be set up in advance.

export const DEFAULT_LAYOUT = {
  hero: {
    line1: "Penticton Robotics",
    line2: "Internal Portal",
    tagline: "Handbooks, team resources, and how the program runs. Everyone on the team, including parents and mentors, can see everything.",
  },
  quickLinks: [
    { label: "Daily Reflection", url: "/reflection", primary: true },
    { label: "Task Board", url: "https://board.pentictonrobotics.ca", primary: false },
  ],
  boxes: [
    {
      key: "prep",
      title: "Prep Team",
      blurb: "For students working through the learning pathway.",
      tools: [],
      items: [{ stream: "prep-team", inline: true, hidden: false }],
    },
    {
      key: "comp",
      title: "Competition Team",
      blurb: "For students on the competition roster.",
      tools: ["reflection"],
      items: [
        { stream: "comp-team", inline: true, hidden: false },
        { stream: "roles", inline: false, hidden: false, noun: "role" },
      ],
    },
    {
      key: "program",
      title: "Whole Program",
      blurb: "For students, parents, and mentors.",
      tools: [],
      items: [
        { stream: "parents", inline: false, hidden: false },
        { stream: "mentors", inline: false, hidden: false },
        { stream: "how-it-runs", inline: false, hidden: false },
        { stream: "career", inline: false, hidden: false },
      ],
    },
  ],
};

export const TOOL_KEYS = ["reflection"];

async function ensureTable(env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS portal_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
  ).run();
}

export async function getLayout(env) {
  try {
    const row = await env.DB.prepare("SELECT value FROM portal_settings WHERE key = 'layout'").first();
    if (row && row.value) return sanitizeLayout(JSON.parse(row.value));
  } catch (e) {
    // table missing or bad JSON: fall through to the defaults
  }
  return sanitizeLayout(DEFAULT_LAYOUT);
}

export async function saveLayout(env, layout) {
  await ensureTable(env);
  const clean = sanitizeLayout(layout);
  await env.DB.prepare(
    "INSERT INTO portal_settings (key, value) VALUES ('layout', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(JSON.stringify(clean)).run();
  return clean;
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function sanitizeLayout(input) {
  const src = input && typeof input === "object" ? input : {};
  const d = DEFAULT_LAYOUT;

  const heroSrc = src.hero && typeof src.hero === "object" ? src.hero : {};
  const hero = {
    line1: heroSrc.line1 === undefined ? d.hero.line1 : str(heroSrc.line1, 80),
    line2: heroSrc.line2 === undefined ? d.hero.line2 : str(heroSrc.line2, 80),
    tagline: heroSrc.tagline === undefined ? d.hero.tagline : str(heroSrc.tagline, 400),
  };

  const quickLinks = (Array.isArray(src.quickLinks) ? src.quickLinks : d.quickLinks)
    .slice(0, 6)
    .map((l) => ({
      label: str(l && l.label, 40),
      url: str(l && l.url, 300),
      primary: Boolean(l && l.primary),
    }))
    .filter((l) => l.label && /^(#\/|\/|https?:\/\/|mailto:)/i.test(l.url));

  const seenBoxes = new Set();
  const seenStreams = new Set();
  const boxes = [];
  (Array.isArray(src.boxes) ? src.boxes : d.boxes).slice(0, 8).forEach((b) => {
    if (!b || typeof b !== "object") return;
    let key = str(b.key, 30).toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!key || seenBoxes.has(key)) return;
    seenBoxes.add(key);
    const items = [];
    (Array.isArray(b.items) ? b.items : []).forEach((it) => {
      const stream = str(it && it.stream, 60);
      if (!stream || seenStreams.has(stream)) return;
      seenStreams.add(stream);
      const item = { stream, inline: Boolean(it.inline), hidden: Boolean(it.hidden) };
      const noun = str(it.noun, 30);
      if (noun) item.noun = noun;
      items.push(item);
    });
    boxes.push({
      key,
      title: str(b.title, 60) || "Untitled box",
      blurb: str(b.blurb, 200),
      tools: (Array.isArray(b.tools) ? b.tools : []).filter((t) => TOOL_KEYS.includes(t)),
      items,
    });
  });
  if (boxes.length === 0) return sanitizeLayout(DEFAULT_LAYOUT);

  return { hero, quickLinks, boxes };
}

// "Safety Team" -> "safety-team", made unique among the given keys.
export function slugify(name, taken) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "section";
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}-${n++}`;
  return key;
}
