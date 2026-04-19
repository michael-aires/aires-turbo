import { View, Text, Pressable } from "react-native";
import { MessageSquare, Phone, Mail } from "lucide-react-native";
import type { CommunicationType } from "~/data/mockData";
import { formatTimeAgo } from "~/data/mockData";

interface ActivityItemProps {
  contactName: string;
  type: CommunicationType;
  content: string;
  timestamp: Date;
  onPress?: () => void;
}

const iconConfig = {
  call: { icon: Phone, color: "#34C759" },
  sms: { icon: MessageSquare, color: "#8E8E93" },
  email: { icon: Mail, color: "#007AFF" },
};

export function ActivityItem({ contactName, type, content, timestamp, onPress }: ActivityItemProps) {
  const config = iconConfig[type];
  const IconComponent = config.icon;

  return (
    <Pressable onPress={onPress} className="flex-row items-start gap-3 py-3">
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#1C1C1E]">
        <IconComponent size={18} color={config.color} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-medium text-white">{contactName}</Text>
        <Text className="text-sm text-gray-400" numberOfLines={1}>
          {content}
        </Text>
      </View>
      <Text className="text-sm text-gray-500">{formatTimeAgo(timestamp)}</Text>
    </Pressable>
  );
}
