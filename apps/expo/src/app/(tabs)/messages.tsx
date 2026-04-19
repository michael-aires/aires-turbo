import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LegendList } from "@legendapp/list";
import { MessageSquare, Edit } from "lucide-react-native";
import { Avatar } from "~/components";
import { communications, getContactById, getContactInitials, getContactFullName, formatTimeAgo } from "~/data/mockData";

// Filter SMS communications and group by contact
const smsConversations = communications
  .filter((c) => c.type === "sms")
  .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

// Mock conversation threads
const mockConversations = [
  {
    id: "conv1",
    contactId: "7",
    lastMessage: "Hi! Yes, I'm still interested in the downtown property. When can we schedule a viewing?",
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    unread: 1,
  },
  {
    id: "conv2",
    contactId: "3",
    lastMessage: "Thanks for sending over the property details. I'll review them tonight.",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    unread: 0,
  },
  {
    id: "conv3",
    contactId: "1",
    lastMessage: "The commercial space looks great. Can we discuss the lease terms?",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    unread: 0,
  },
  {
    id: "conv4",
    contactId: "6",
    lastMessage: "Perfect, see you at the open house on Saturday!",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    unread: 0,
  },
];

export default function Messages() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4">
        <Text className="text-2xl font-bold text-white">Messages</Text>
        <Pressable className="rounded-full bg-[#1C1C1E] p-3">
          <Edit size={20} color="#F5A524" />
        </Pressable>
      </View>

      {/* Conversation List */}
      <LegendList
        data={mockConversations}
        keyExtractor={(item) => item.id}
        estimatedItemSize={80}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ItemSeparatorComponent={() => <View className="h-px bg-[#1C1C1E]" />}
        renderItem={({ item }) => {
          const contact = getContactById(item.contactId);
          if (!contact) return null;

          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/contact/[id]",
                  params: { id: item.contactId },
                })
              }
              className="flex-row items-center gap-3 py-3"
            >
              <View className="relative">
                <Avatar
                  initials={getContactInitials(contact)}
                  color={contact.avatarColor}
                  size="lg"
                />
                {item.unread > 0 && (
                  <View className="absolute -right-0.5 -top-0.5 h-5 w-5 items-center justify-center rounded-full bg-[#F5A524]">
                    <Text className="text-xs font-bold text-black">{item.unread}</Text>
                  </View>
                )}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-white">
                    {getContactFullName(contact)}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {formatTimeAgo(item.timestamp)}
                  </Text>
                </View>
                <Text
                  className={`mt-0.5 text-sm ${item.unread > 0 ? "text-white" : "text-gray-400"}`}
                  numberOfLines={2}
                >
                  {item.lastMessage}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={() => (
          <View className="items-center justify-center py-12">
            <MessageSquare size={48} color="#1C1C1E" />
            <Text className="mt-4 text-lg text-gray-400">No messages yet</Text>
            <Text className="mt-1 text-sm text-gray-500">
              Start a conversation with your contacts
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
