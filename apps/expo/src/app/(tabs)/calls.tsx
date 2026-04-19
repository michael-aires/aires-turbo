import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LegendList } from "@legendapp/list";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react-native";
import { Avatar } from "~/components";
import { getContactById, getContactInitials, getContactFullName, formatTimeAgo } from "~/data/mockData";

// Add some mock call history
const mockCalls = [
  {
    id: "call1",
    contactId: "7",
    direction: "outbound" as const,
    duration: 420,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: "completed" as const,
  },
  {
    id: "call2",
    contactId: "3",
    direction: "inbound" as const,
    duration: 0,
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    status: "missed" as const,
  },
  {
    id: "call3",
    contactId: "1",
    direction: "outbound" as const,
    duration: 180,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: "completed" as const,
  },
  {
    id: "call4",
    contactId: "2",
    direction: "inbound" as const,
    duration: 300,
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
    status: "completed" as const,
  },
];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Calls() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4">
        <Text className="text-2xl font-bold text-white">Calls</Text>
        <Pressable className="rounded-full bg-[#34C759] p-3">
          <Phone size={20} color="white" />
        </Pressable>
      </View>

      {/* Call History */}
      <LegendList
        data={mockCalls}
        keyExtractor={(item) => item.id}
        estimatedItemSize={72}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ItemSeparatorComponent={() => <View className="h-px bg-[#1C1C1E]" />}
        renderItem={({ item }) => {
          const contact = getContactById(item.contactId);
          if (!contact) return null;

          const IconComponent =
            item.status === "missed"
              ? PhoneMissed
              : item.direction === "inbound"
                ? PhoneIncoming
                : PhoneOutgoing;
          const iconColor = item.status === "missed" ? "#FF3B30" : "#34C759";

          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/call/[id]",
                  params: { id: item.contactId },
                })
              }
              className="flex-row items-center gap-3 py-3"
            >
              <Avatar
                initials={getContactInitials(contact)}
                color={contact.avatarColor}
                size="md"
              />
              <View className="flex-1">
                <Text className="text-base font-medium text-white">
                  {getContactFullName(contact)}
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <IconComponent size={14} color={iconColor} />
                  <Text className="text-sm text-gray-400">
                    {item.status === "missed"
                      ? "Missed"
                      : item.direction === "inbound"
                        ? "Incoming"
                        : "Outgoing"}
                    {item.duration > 0 && ` \u2022 ${formatDuration(item.duration)}`}
                  </Text>
                </View>
              </View>
              <Text className="text-sm text-gray-500">
                {formatTimeAgo(item.timestamp)}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={() => (
          <View className="items-center justify-center py-12">
            <Phone size={48} color="#1C1C1E" />
            <Text className="mt-4 text-lg text-gray-400">No calls yet</Text>
            <Text className="mt-1 text-sm text-gray-500">
              Start making calls to build your history
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
