// Medication domain types. See CLAUDE.md §5, "Medication form drives
// everything" — form determines the dose unit picker, the supply unit, the
// icon, and whether to prompt for a side (laterality — V1.5, not built yet).

export type MedicationForm =
  | "tablet"
  | "capsule"
  | "liquid"
  | "injection"
  | "drops"
  | "inhaler"
  | "patch"
  | "topical"
  | "vitamin";

export interface FormMeta {
  label: string;
  doseUnit: string;
  supplyUnit: string;
  /** True if supply for this form can't be counted reliably — see CLAUDE.md §5. */
  supplyPoorlyCountable: boolean;
}

// See CLAUDE.md §5's form table. Drops and inhalers are flagged
// poorly-countable there — the UI must label their supply as estimated and
// prompt for manual correction more readily than other forms.
export const formMeta: Record<MedicationForm, FormMeta> = {
  tablet: { label: "Tablet", doseUnit: "tablet", supplyUnit: "tablets", supplyPoorlyCountable: false },
  capsule: { label: "Capsule", doseUnit: "capsule", supplyUnit: "capsules", supplyPoorlyCountable: false },
  liquid: { label: "Liquid", doseUnit: "ml", supplyUnit: "ml in bottle", supplyPoorlyCountable: false },
  injection: { label: "Injection", doseUnit: "units/IU or mg", supplyUnit: "pens/vials", supplyPoorlyCountable: false },
  drops: { label: "Drops", doseUnit: "drops", supplyUnit: "drops", supplyPoorlyCountable: true },
  inhaler: { label: "Inhaler", doseUnit: "puffs", supplyUnit: "puffs", supplyPoorlyCountable: true },
  patch: { label: "Patch", doseUnit: "patch", supplyUnit: "patches", supplyPoorlyCountable: false },
  topical: { label: "Topical", doseUnit: "application", supplyUnit: "tubes", supplyPoorlyCountable: false },
  // Not in CLAUDE.md §5's original form table — added per the developer's
  // request 2026-09-23. Behaves like tablet/capsule: count-based dosing,
  // reliably countable supply. Kept as its own form (not merged into
  // tablet/capsule) so the medicine list and icon can visually distinguish
  // supplements from prescription medications, which the target users
  // (per CLAUDE.md §1) are likely to be juggling side by side.
  vitamin: { label: "Vitamin", doseUnit: "tablet", supplyUnit: "tablets", supplyPoorlyCountable: false },
};

export interface Medication {
  id: string;
  name: string;
  genericName: string | null;
  form: MedicationForm;
  /** Physical description — e.g. "small white oblong". Not medical advice; recognition aid only. */
  description: string | null;
  colorTag: string;
  /** Relative path under the app's document directory — see CLAUDE.md §5, "Photos". */
  photoPath: string | null;
  doseAmount: string | null;
  doseUnit: string | null;
  notes: string | null;
  supplyRemaining: number | null;
  supplyThreshold: number | null;
  archivedAt: number | null;
}
