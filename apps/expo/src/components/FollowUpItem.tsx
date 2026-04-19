import { View, Text, Pressable } from "react-native";
import { Calendar } from "lucide-react-native";
import { formatDate } from "~/data/mockData";

interface FollowUpItemProps {
  title: string;
  contactName: string;
  dueDate: Date;
  onPress?: () => void;
}

export function FollowUpItem({ title, contactName, dueDate, onPress }: FollowUpItemProps) {
  return (
    <Pressable onPress={onPress} className="flex-row items-start gap-3 py-3">
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#F5A524]/20">
        <Calendar size={18} color="#F5A524" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-medium text-white">{title}</Text>
        <Text className="text-sm text-gray-400">{contactName}</Text>
      </View>
      <Text className="text-sm text-gray-500">{formatDate(dueDate)}</Text>
    </Pressable>
  );
}
