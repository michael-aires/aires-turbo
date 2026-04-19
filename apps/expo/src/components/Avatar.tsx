import { View, Text } from "react-native";

interface AvatarProps {
  initials: string;
  color: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeStyles = {
  sm: { container: "h-8 w-8", text: "text-xs" },
  md: { container: "h-10 w-10", text: "text-sm" },
  lg: { container: "h-14 w-14", text: "text-lg" },
  xl: { container: "h-20 w-20", text: "text-2xl" },
};

export function Avatar({ initials, color, size = "md" }: AvatarProps) {
  const styles = sizeStyles[size];

  return (
    <View
      className={`${styles.container} items-center justify-center rounded-full`}
      style={{ backgroundColor: color }}
    >
      <Text className={`${styles.text} font-semibold text-white`}>
        {initials}
      </Text>
    </View>
  );
}
