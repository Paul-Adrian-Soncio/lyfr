// The L-monogram logo. See CLAUDE.md §7: "an L monogram whose base curves
// into a cradle holding a dose dot." Extracted from the mockup
// (project/Main.dc.html, project/LockScreen.dc.html), which uses this same
// mark at different sizes and background/dot colours per surface.

import Svg, { Circle, Path, Rect } from "react-native-svg";

interface LyfrLogoProps {
  size?: number;
  backgroundColor?: string;
  strokeColor?: string;
  dotColor?: string;
}

export function LyfrLogo({
  size = 36,
  backgroundColor = "#1B4767",
  strokeColor = "#FFFFFF",
  dotColor = "#7FA0BC",
}: LyfrLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Rect width={160} height={160} rx={36} fill={backgroundColor} />
      <Path
        d="M54 38 L54 94 Q54 114 74 114 L118 114"
        fill="none"
        stroke={strokeColor}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={104} cy={86} r={16} fill={dotColor} />
    </Svg>
  );
}
