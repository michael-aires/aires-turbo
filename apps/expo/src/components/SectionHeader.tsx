import { View, Text, Pressable } from "react-native";

interface SectionHeaderProps {
  title: string;
  actionText?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionText, onAction }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-lg font-semibold text-white">{title}</Text>
      {actionText && (
        <Pressable onPress={onAction}>
          <Text className="text-sm font-medium text-[#F5A524]">{actionText}</Text>
        </Pressable>
      )}
    </View>
  );
}
