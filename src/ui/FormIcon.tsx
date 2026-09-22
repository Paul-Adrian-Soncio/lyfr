// Per-form icons. See CLAUDE.md §5, "form is a first-class field... it
// determines... the icon" and §1, "recognition beats reading." Six of these
// (tablet, capsule, liquid, injection, drops, inhaler) are drawn from the
// mockup's AddMedication.dc.html exactly. Patch, topical and vitamin have
// no mockup reference — drawn to match the same stroke conventions
// (24x24 viewBox, round caps/joins, 2px stroke) since the mockup didn't
// design for them; revisit if a real mockup for these ever exists.

import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { MedicationForm } from "@/domain/medication";

interface FormIconProps {
  form: MedicationForm;
  size?: number;
  color?: string;
}

export function FormIcon({ form, size = 20, color = "#1B4767" }: FormIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (form) {
    case "tablet":
    case "vitamin":
      // Vitamin reuses tablet's mark — see src/domain/medication.ts, both
      // are count-based forms. Distinguished elsewhere by colour tag/label,
      // not a different icon shape, to keep the icon set legible.
      return (
        <Svg {...common}>
          <Circle cx={12} cy={12} r={8} />
          <Path d="M6.5 17.5 L17.5 6.5" />
        </Svg>
      );
    case "capsule":
      return (
        <Svg {...common}>
          <Rect x={2.5} y={8.5} width={19} height={7} rx={3.5} transform="rotate(-45 12 12)" />
          <Path d="M12 8.5 V15.5" transform="rotate(-45 12 12)" />
        </Svg>
      );
    case "liquid":
      return (
        <Svg {...common}>
          <Path d="M9 3 h6" />
          <Path d="M10 3 v3 L7 9.5 V19 a2 2 0 0 0 2 2 h6 a2 2 0 0 0 2 -2 V9.5 L14 6 V3" />
          <Path d="M7 14 h10" />
        </Svg>
      );
    case "injection":
      return (
        <Svg {...common}>
          <Path d="M18 2 l4 4" />
          <Path d="M20 4 l-3 3" />
          <Path d="M17 7 L7.5 16.5 H4.5 V13.5 L14 4 z" />
          <Path d="M4.5 19.5 L2 22" />
        </Svg>
      );
    case "drops":
      return (
        <Svg {...common}>
          <Path d="M12 3 C12 3 5.5 10.5 5.5 15 a6.5 6.5 0 0 0 13 0 C18.5 10.5 12 3 12 3 z" />
        </Svg>
      );
    case "inhaler":
      return (
        <Svg {...common}>
          <Rect x={6} y={2.5} width={8} height={12} rx={2} />
          <Path d="M6 14.5 v4 a2 2 0 0 0 2 2 h9.5 v-6 H14" />
        </Svg>
      );
    case "patch":
      // No mockup reference — a rounded square with a dashed inset border,
      // reading as an adhesive patch.
      return (
        <Svg {...common}>
          <Rect x={4} y={4} width={16} height={16} rx={4} />
          <Rect x={8} y={8} width={8} height={8} rx={2} strokeDasharray="2 2" />
        </Svg>
      );
    case "topical":
      // No mockup reference — a tube with a cap, matching the "Injection"
      // icon's diagonal composition style.
      return (
        <Svg {...common}>
          <Path d="M9 3 h6 v3 H9 z" />
          <Path d="M10.5 6 H13.5 L15 9 V19 a2 2 0 0 1 -2 2 h-2 a2 2 0 0 1 -2 -2 V9 z" />
        </Svg>
      );
  }
}
