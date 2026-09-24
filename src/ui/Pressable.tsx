// Drop-in replacement for React Native's Pressable that visibly reacts while
// held. A bare Pressable gives no feedback, so a press can look like it
// didn't register — and the likely response, pressing again, is exactly
// what shouldn't happen on Taken or Snooze. Use this for every tappable
// element in the app rather than importing Pressable from react-native.

import type { ComponentProps } from "react";
import { Pressable as RNPressable, type PressableStateCallbackType, type StyleProp, type ViewStyle } from "react-native";

type Props = ComponentProps<typeof RNPressable>;

// Dimming carries most of the signal; the slight shrink makes it read as
// "pushed in" rather than disabled.
const pressedStyle: ViewStyle = { opacity: 0.7, transform: [{ scale: 0.97 }] };

export function Pressable({ style, disabled, ...rest }: Props) {
  return (
    <RNPressable
      {...rest}
      disabled={disabled}
      style={(state: PressableStateCallbackType): StyleProp<ViewStyle> => {
        const base = typeof style === "function" ? style(state) : style;
        return state.pressed && !disabled ? [base, pressedStyle] : base;
      }}
    />
  );
}
