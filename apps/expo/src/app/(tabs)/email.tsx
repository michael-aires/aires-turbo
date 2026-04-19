import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LegendList } from "@legendapp/list";
import { Mail, Edit, Paperclip } from "lucide-react-native";
import { Avatar } from "~/components";
import { getContactById, getContactInitials, getContactFullName, formatTimeAgo } from "~/data/mockData";

// Mock email threads
const mockEmails = [
  {
    id: "email1",
    contactId: "1",
    subject: "Re: Commercial Property Inquiry - Chen Ventures",
    preview: "Hi Michael, I found several commercial spaces that match your requirements. Would you like to schedule...",
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    unread: true,
    hasAttachment: true,
  },
  {
    id: "email2",
    contactId: "7",
    subject: "Property Viewing Confirmation",
    preview: "Dear Sarah, This email confirms your property viewing appointment for Saturday at 2:00 PM...",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    unread: false,
    hasAttachment: false,
  },
  {
    id: "email3",
    contactId: "2",
    subject: "Residential Properties in Suburban Area",
    preview: "Hi Lisa, Following up on your inquiry about residential properties. I've attached a list of...",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    unread: false,
    hasAttachment: true,
  },
  {
    id: "email4",
    contactId: "3",
    subject: "Re: Family Home Search",
    preview: "John, Great news! I found two properties that meet your criteria for a 4+ bedroom home...",
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
    unread: false,
    hasAttachment: false,
  },
  {
    id: "email5",
    contactId: "6",
    subject: "Open House Invitation - Sunday",
    preview: "Dear Emily, You're invited to an exclusive open house this Sunday from 1-4 PM...",
    timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000),
    unread: false,
    hasAttachment: true,
  },
];

export default function Email() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4">
        <Text className="text-2xl font-bold text-white">Email</Text>
        <Pressable className="rounded-full bg-[#1C1C1E] p-3">
          <Edit size={20} color="#F5A524" />
        </Pressable>
      </View>

      {/* Email List */}
      <LegendList
        data={mockEmails}
        keyExtractor={(item) => item.id}
        estimatedItemSize={100}
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
              className="flex-row items-start gap-3 py-3"
            >
              <Avatar
                initials={getContactInitials(contact)}
                color={contact.avatarColor}
                size="md"
              />
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-base ${item.unread ? "font-semibold text-white" : "font-medium text-gray-300"}`}
                  >
                    {getContactFullName(contact)}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {formatTimeAgo(item.timestamp)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Text
                    className={`flex-1 text-sm ${item.unread ? "font-medium text-white" : "text-gray-400"}`}
                    numberOfLines={1}
                  >
                    {item.subject}
                  </Text>
                  {item.hasAttachment && <Paperclip size={14} color="#8E8E93" />}
                </View>
                <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={2}>
                  {item.preview}
                </Text>
              </View>
              {item.unread && (
                <View className="mt-1 h-2.5 w-2.5 rounded-full bg-[#007AFF]" />
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={() => (
          <View className="items-center justify-center py-12">
            <Mail size={48} color="#1C1C1E" />
            <Text className="mt-4 text-lg text-gray-400">No emails yet</Text>
            <Text className="mt-1 text-sm text-gray-500">
              Your email inbox is empty
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
