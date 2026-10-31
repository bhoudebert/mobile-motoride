import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "./theme.ts";

/** The pictures of the ride screen. Hidden from a screen reader: the button around says what it does. */
export type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function Icon({ name, color = colors.accent, size = 24 }: { name: IconName; color?: string; size?: number }) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** A motorcycle: Ionicons has none, so it comes from Font Awesome. */
export function MotorcycleIcon({ color = colors.accent, size = 24 }: { color?: string; size?: number }) {
  return (
    <FontAwesome6
      name="motorcycle"
      size={size}
      color={color}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
