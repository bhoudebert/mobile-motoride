import { useRef, type ReactNode } from "react";
import { View } from "react-native";
import { isSwipeBack } from "../core/swipeBack.ts";

/**
 * A screen that goes back when the finger is swept from the left edge to the right, as the phone's own screens do. It
 * only watches the touches, so taps and scrolls inside it are not changed.
 */
export function SwipeBack({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={(e) => {
        start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      }}
      onTouchEnd={(e) => {
        const from = start.current;
        start.current = null;
        if (from && isSwipeBack(from.x, from.y, e.nativeEvent.pageX, e.nativeEvent.pageY)) onBack();
      }}
      onTouchCancel={() => {
        start.current = null;
      }}
    >
      {children}
    </View>
  );
}
