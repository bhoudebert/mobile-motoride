import { StyleSheet, View } from "react-native";
import { colors, themed } from "./theme.ts";

/** Small icons drawn with views: no icon font to load, and they take the colour of the text around them. */
type IconProps = { color?: string; size?: number };

export function MenuIcon({ color = colors.accent, size = 22 }: IconProps) {
  const bar = { backgroundColor: color, height: Math.max(2, size / 9), borderRadius: 2 };
  return (
    <View style={{ width: size, height: size, justifyContent: "space-between", paddingVertical: size / 5 }}>
      <View style={bar} />
      <View style={bar} />
      <View style={bar} />
    </View>
  );
}

export function SearchIcon({ color = colors.accent, size = 22 }: IconProps) {
  const ring = size * 0.66;
  const w = Math.max(2, size / 9);
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: ring, height: ring, borderRadius: ring / 2, borderWidth: w, borderColor: color }} />
      <View
        style={{
          position: "absolute",
          right: size * 0.04,
          bottom: size * 0.08,
          width: size * 0.34,
          height: w,
          borderRadius: w,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

/** A target: the rider's position. */
export function LocateIcon({ color = colors.accent, size = 22 }: IconProps) {
  const w = Math.max(2, size / 10);
  return (
    <View style={[styles.centre, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: size,
          borderWidth: w,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={{ width: size * 0.2, height: size * 0.2, borderRadius: size, backgroundColor: color }} />
      </View>
      <View style={{ position: "absolute", top: 0, width: w, height: size * 0.2, backgroundColor: color }} />
      <View style={{ position: "absolute", bottom: 0, width: w, height: size * 0.2, backgroundColor: color }} />
      <View style={{ position: "absolute", left: 0, height: w, width: size * 0.2, backgroundColor: color }} />
      <View style={{ position: "absolute", right: 0, height: w, width: size * 0.2, backgroundColor: color }} />
    </View>
  );
}

/** A pin: a place. */
export function PinIcon({ color = colors.rust, size = 22 }: IconProps) {
  const head = size * 0.62;
  return (
    <View style={[styles.centre, { width: size, height: size }]}>
      <View
        style={{
          width: head,
          height: head,
          borderRadius: head / 2,
          borderBottomRightRadius: 2,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={{ width: head * 0.36, height: head * 0.36, borderRadius: head, backgroundColor: colors.card }} />
      </View>
    </View>
  );
}

/** A winding road: a roadbook. */
export function RoadIcon({ color = colors.accent, size = 22 }: IconProps) {
  const w = Math.max(3, size / 6);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: "absolute",
          left: size * 0.12,
          top: size * 0.06,
          width: size * 0.6,
          height: size * 0.46,
          borderTopLeftRadius: size,
          borderBottomLeftRadius: size,
          borderWidth: w,
          borderColor: color,
          borderRightWidth: 0,
        }}
      />
      <View
        style={{
          position: "absolute",
          right: size * 0.12,
          bottom: size * 0.06,
          width: size * 0.6,
          height: size * 0.46,
          borderTopRightRadius: size,
          borderBottomRightRadius: size,
          borderWidth: w,
          borderColor: color,
          borderLeftWidth: 0,
        }}
      />
    </View>
  );
}

export function CloseIcon({ color = colors.accent, size = 20 }: IconProps) {
  const w = Math.max(2, size / 9);
  const bar = {
    position: "absolute" as const,
    top: size / 2 - w / 2,
    width: size,
    height: w,
    borderRadius: w,
    backgroundColor: color,
  };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[bar, { transform: [{ rotate: "45deg" }] }]} />
      <View style={[bar, { transform: [{ rotate: "-45deg" }] }]} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({ centre: { alignItems: "center", justifyContent: "center" } }));
