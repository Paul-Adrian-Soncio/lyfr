// Design tokens. See CLAUDE.md §7 for rationale — do not add colours here
// without checking the contrast and colourblind-safety notes there first.
//
// Extended 2026-09-22 to match the real mockup (Main/LockScreen/
// AddMedication/History), which is the source of truth for component
// conventions from here on — see the notes below each token group.

export const brand = {
  rime: "#EDF1F5",
  frost: "#CBD9E5",
  fjord: "#7FA0BC",
  sea: "#34688F",
  deep: "#1B4767",
  woad: "#0D2839",
} as const;

export const doseStatus = {
  taken: { fill: "#1B4767", icon: "check" },
  upcoming: { outline: "#5B6B78", icon: "clock" },
  missed: { fill: "#9A4E06", icon: "exclamation" },
  skipped: { fill: "#5B6B78", icon: "minus" },
} as const;

// Okabe-Ito derived, colourblind-safe. Eight is the cap — see CLAUDE.md §7.
export const medicationTags = [
  "#D55E00", // vermillion
  "#009E73", // green
  "#CC79A7", // rose
  "#E69F00", // amber
  "#7A3E9D", // purple
  "#56B4E9", // sky
  "#8C6D3F", // brass
  "#3F4A45", // slate
] as const;

function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Woad or white, whichever contrasts more with a medication tag colour. */
export function iconColorOn(background: string): string {
  const bg = relativeLuminance(background);
  const onWhite = 1.05 / (bg + 0.05);
  const onWoad = (bg + 0.05) / (relativeLuminance("#0D2839") + 0.05);
  return onWoad > onWhite ? "#0D2839" : "#FFFFFF";
}

export const dark = {
  background: "#0B1620",
  surface: "#14212C",
  // The mockup's LockScreen uses a distinct, slightly lighter card surface
  // than the base dark surface above — #1A2A38, for a card sitting on top
  // of the dark background (e.g. the lock-screen reminder card).
  cardSurface: "#1A2A38",
  border: "#263644",
  text: "#E6EDF4",
  // Secondary/muted text on dark surfaces (timestamps, captions).
  textMuted: "#A9BACB",
  accent: brand.fjord,
} as const;

export const light = {
  background: brand.rime,
  surface: "#FFFFFF",
  border: brand.frost,
  text: brand.woad,
  // Secondary/muted text on light surfaces — subtitles, metadata, dates.
  // Used far more often in the mockup than pure `text` for anything that
  // isn't a heading or primary label.
  textMuted: "#3D5163",
  accent: brand.deep,
} as const;

export const typography = {
  bodyMinSp: 18,
  medicationNameMinSp: 22,
  absoluteMinSp: 16,
  // The wordmark ("lyfr") uses Manrope bold, splash/about screens only —
  // see CLAUDE.md §7. Everything else stays on the system font.
  wordmarkFontFamily: "Manrope",
} as const;

// Component conventions observed across the mockup — not enforced by types,
// but new screens should match these rather than inventing new values.
export const radii = {
  card: 16,
  cardLarge: 24, // hero/section cards, e.g. the Today "Next dose" card
  button: 14,
  buttonLarge: 16,
  pill: 999, // status badges, chips
} as const;

export const buttonHeights = {
  standard: 56,
  primary: 60, // full-width primary CTA, e.g. "Next: set schedule"
} as const;

// Primary button: solid `accent` fill, white text, bold 700.
// Secondary/outline button: 2px solid `brand.fjord` border, transparent
// background, text colour matches context (dark text on light, white on
// dark surfaces).
// Status badge/pill: `radii.pill`, padding 6px 10px, icon + label together.
// Solid fill for negative/attention states (missed, amber #9A4E06 — never
// red, see CLAUDE.md §7), 2px outline for neutral/upcoming states.
