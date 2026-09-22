import { Link } from "expo-router";
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
      <Link href="/add-medication">
        <Text allowFontScaling style={styles.link}>
          Add medicine
        </Text>
      </Link>
      <Link href="/doze-spike">
        <Text allowFontScaling style={styles.link}>
          Doze spike (dev)
        </Text>
      </Link>
      <Link href="/scheduler-spike">
        <Text allowFontScaling style={styles.link}>
          Scheduler spike (dev)
        </Text>
      </Link>
      <Link href="/battery-walkthrough">
        <Text allowFontScaling style={styles.link}>
          Battery walkthrough (dev)
        </Text>
      </Link>
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
  link: {
    fontSize: typography.bodyMinSp,
    color: light.text,
    textDecorationLine: "underline",
  },
});
