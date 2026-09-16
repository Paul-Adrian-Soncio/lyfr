import { StyleSheet, Text, View } from "react-native";
import { light, typography } from "@/theme/tokens";

export default function TodayScreen() {
  return (
    <View style={styles.container}>
      <Text allowFontScaling style={styles.title}>
        Lyfr
      </Text>
      <Text allowFontScaling style={styles.body}>
        Today view goes here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: light.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  title: {
    fontSize: typography.medicationNameMinSp,
    color: light.text,
    fontWeight: "600",
  },
  body: {
    fontSize: typography.bodyMinSp,
    color: light.text,
  },
});
