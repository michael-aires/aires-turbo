import { View, Text } from "react-native";
import type { LeadStatus } from "~/data/mockData";

interface StatusBadgeProps {
  status: LeadStatus;
  size?: "sm" | "md";
}

const statusConfig: Record<LeadStatus, { label: string; bgColor: string; textColor: string }> = {
  hot: { label: "HOT", bgColor: "bg-orange-500/20", textColor: "text-orange-500" },
  qualified: { label: "QUALIFIED", bgColor: "bg-blue-500/20", textColor: "text-blue-500" },
  nurturing: { label: "NURTURING", bgColor: "bg-green-500/20", textColor: "text-green-500" },
  new: { label: "NEW", bgColor: "bg-gray-500/20", textColor: "text-gray-400" },
  cold: { label: "COLD", bgColor: "bg-blue-300/20", textColor: "text-blue-300" },
  won: { label: "WON", bgColor: "bg-emerald-500/20", textColor: "text-emerald-500" },
  lost: { label: "LOST", bgColor: "bg-red-500/20", textColor: "text-red-500" },
};

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";

  return (
    <View className={`${config.bgColor} rounded-full ${sizeClass}`}>
      <Text className={`${config.textColor} font-semibold`}>
        {config.label}
      </Text>
    </View>
  );
}
