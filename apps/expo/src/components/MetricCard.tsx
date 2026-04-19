import { View, Text } from "react-native";
import { Users, Flame, Phone, Calendar } from "lucide-react-native";

interface MetricCardProps {
  title: string;
  value: number;
  type: "contacts" | "hot" | "calls" | "followups";
}

const iconConfig = {
  contacts: { icon: Users, color: "#8E8E93" },
  hot: { icon: Flame, color: "#F5A524" },
  calls: { icon: Phone, color: "#34C759" },
  followups: { icon: Calendar, color: "#F5A524" },
};

export function MetricCard({ title, value, type }: MetricCardProps) {
  const config = iconConfig[type];
  const IconComponent = config.icon;

  return (
    <View className="flex-1 rounded-xl bg-[#1C1C1E] p-4">
      <View className="flex-row items-center gap-2">
        <IconComponent size={16} color={config.color} />
        <Text className="text-sm text-gray-400">{title}</Text>
      </View>
      <Text className="mt-2 text-3xl font-bold text-white">{value}</Text>
    </View>
  );
}
