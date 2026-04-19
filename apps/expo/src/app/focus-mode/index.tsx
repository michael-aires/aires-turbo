import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LegendList } from "@legendapp/list";
import { ChevronLeft, Calendar, Mail, Phone } from "lucide-react-native";
import { Avatar, StatusBadge, TabButton } from "~/components";
import {
  followUps,
  getContactById,
  getContactInitials,
  getContactFullName,
} from "~/data/mockData";
import type { FollowUp } from "~/data/mockData";

const tabs = [
  { key: "priority", label: "Priority" },
  { key: "all", label: "All Tasks" },
];

function TaskCard({ followUp, onPress }: { followUp: FollowUp; onPress: () => void }) {
  const contact = getContactById(followUp.contactId);
  if (!contact) return null;

  const iconConfig = {
    call: { icon: Phone, color: "#34C759", bgColor: "bg-green-500/20" },
    email: { icon: Mail, color: "#007AFF", bgColor: "bg-blue-500/20" },
    meeting: { icon: Calendar, color: "#F5A524", bgColor: "bg-orange-500/20" },
    task: { icon: Calendar, color: "#8E8E93", bgColor: "bg-gray-500/20" },
  };

  const config = iconConfig[followUp.actionType];
  const IconComponent = config.icon;

  const isToday = followUp.dueDate.toDateString() === new Date().toDateString();

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl bg-[#1C1C1E] p-4"
    >
      <Avatar
        initials={getContactInitials(contact)}
        color={contact.avatarColor}
        size="lg"
      />
      <View className="flex-1">
        <Text className="text-lg font-semibold text-white">
          {getContactFullName(contact)}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-2">
          <Text className="text-sm text-gray-400">{contact.leadStatus}</Text>
          <Text className="text-sm text-gray-500">\u2022</Text>
          <Text className="text-sm text-gray-400">Buyer</Text>
        </View>
      </View>
      <View className="items-end gap-1">
        <View className={`flex-row items-center gap-1.5 rounded-lg ${config.bgColor} px-2.5 py-1`}>
          <IconComponent size={14} color={config.color} />
          <Text style={{ color: config.color }} className="text-xs font-medium">
            {followUp.title}
          </Text>
        </View>
        <Text className={`text-xs ${isToday ? "text-[#F5A524]" : "text-gray-500"}`}>
          {isToday ? "Due Today" : followUp.dueDate.toLocaleDateString()}
        </Text>
      </View>
    </Pressable>
  );
}

export default function FocusMode() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("priority");

  // Get tasks based on tab
  const tasks = followUps.filter((f) => !f.completed);
  const priorityTasks = tasks.filter((f) => {
    const contact = getContactById(f.contactId);
    return contact?.leadStatus === "hot" || contact?.leadStatus === "qualified";
  });

  const displayTasks = activeTab === "priority" ? priorityTasks : tasks;

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <ChevronLeft size={24} color="white" />
        </Pressable>
        <Text className="text-xl font-semibold text-white">Focus Mode</Text>
      </View>

      {/* Tab Buttons */}
      <View className="px-4 py-3">
        <TabButton tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </View>

      {/* Task List */}
      <LegendList
        data={displayTasks}
        keyExtractor={(item) => item.id}
        estimatedItemSize={96}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => (
          <TaskCard
            followUp={item}
            onPress={() =>
              router.push({
                pathname: "/focus-mode/[id]",
                params: { id: item.contactId },
              })
            }
          />
        )}
        ListEmptyComponent={() => (
          <View className="items-center justify-center py-12">
            <Text className="text-lg text-gray-400">No tasks</Text>
            <Text className="mt-1 text-sm text-gray-500">
              You're all caught up!
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
