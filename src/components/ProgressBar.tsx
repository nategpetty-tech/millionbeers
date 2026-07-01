import { View } from "react-native";
import { theme } from "@/theme";
import { percent } from "@/utils/format";

type Props = {
  current: number;
  goal: number;
  height?: number;
  color?: string;
};

export function ProgressBar({ current, goal, height = 9, color = theme.colors.primary }: Props) {
  return (
    <View
      style={{
        height,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.progressTrack,
        overflow: "hidden"
      }}
    >
      <View
        style={{
          width: `${percent(current, goal)}%`,
          height: "100%",
          borderRadius: theme.radius.pill,
          backgroundColor: color
        }}
      />
    </View>
  );
}
