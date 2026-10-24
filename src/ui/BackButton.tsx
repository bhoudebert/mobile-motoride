import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { Icon } from "./Icon.tsx";

/** The way back at the top of a screen: a bold arrow, not a word, so that it is the same in every language. */
export function BackButton({
  onPress,
  label,
  style,
}: {
  onPress: () => void;
  /** What a screen reader says. */
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable style={style} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name="arrow-back" size={30} />
    </Pressable>
  );
}
