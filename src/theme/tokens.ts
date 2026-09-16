// Design tokens. See CLAUDE.md §7 for rationale — do not add colours here
// without checking the contrast and colourblind-safety notes there first.

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

export const dark = {
  background: "#0B1620",
  surface: "#14212C",
  border: "#263644",
  text: "#E6EDF4",
  accent: brand.fjord,
} as const;

export const light = {
  background: brand.rime,
  surface: "#FFFFFF",
  border: brand.frost,
  text: brand.woad,
  accent: brand.deep,
} as const;

export const typography = {
  bodyMinSp: 18,
  medicationNameMinSp: 22,
  absoluteMinSp: 16,
} as const;
