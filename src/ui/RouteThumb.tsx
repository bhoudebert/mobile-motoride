import { useMemo, useState } from "react";
import { View } from "react-native";
import { thumbSegments } from "../core/thumb.ts";
import type { LatLon } from "../core/types.ts";
import { colors } from "./theme.ts";

const WIDTH = 3;

/** The shape of a roadbook drawn faintly behind what a tile says; not read by a screen reader. */
export function RouteThumb({ line }: { line: LatLon[] }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const segments = useMemo(() => thumbSegments(line, size.w, size.h), [line, size.w, size.h]);
  return (
    <View
      testID="route-thumb"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.16 }}
      onLayout={(e) =>
        setSize({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })
      }
    >
      {segments.map((s, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: s.x - s.length / 2,
            top: s.y - WIDTH / 2,
            width: s.length + 1,
            height: WIDTH,
            borderRadius: WIDTH / 2,
            backgroundColor: colors.accent,
            transform: [{ rotate: `${s.angle}rad` }],
          }}
        />
      ))}
    </View>
  );
}
