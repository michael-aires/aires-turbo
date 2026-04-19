import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus, TrendingUp } from "lucide-react-native";
import { MetricCard, SectionHeader, ActivityItem, FollowUpItem, Avatar } from "~/components";
import {
  getDashboardMetrics,
  recentActivity,
  followUps,
  contacts,
  getContactById,
  getContactFullName,
} from "~/data/mockData";

export default function Dashboard() {
  const router = useRouter();
  const metrics = getDashboardMetrics();

  // Get upcoming follow-ups (next 5, not completed)
  const upcomingFollowUps = followUps
    .filter((f) => !f.completed)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 5);

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="pb-6">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4">
          <View className="flex-row items-center gap-3">
            <Avatar initials="MM" color="#8E8E93" size="md" />
            <View>
              <Text className="text-xl font-semibold text-white">Good morning!</Text>
              <Text className="text-sm text-gray-400">Ready to close some deals?</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/contact/add")}
            className="flex-row items-center gap-1.5 rounded-full bg-[#F5A524] px-4 py-2"
          >
            <Plus size={16} color="black" strokeWidth={2.5} />
            <Text className="font-semibold text-black">Add Lead</Text>
          </Pressable>
        </View>

        {/* Metrics Grid */}
        <View className="gap-3 px-4">
          <View className="flex-row gap-3">
            <MetricCard title="Total Contacts" value={metrics.totalContacts} type="contacts" />
            <MetricCard title="Hot Leads" value={metrics.hotLeads} type="hot" />
          </View>
          <View className="flex-row gap-3">
            <MetricCard title="Calls Today" value={metrics.callsToday} type="calls" />
            <MetricCard title="Follow-ups Due" value={metrics.followUpsDue} type="followups" />
          </View>
        </View>

        {/* Focus Mode Button */}
        <View className="px-4 pt-4">
          <Pressable
            onPress={() => router.push("/focus-mode")}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-[#F5A524] py-4"
          >
            <TrendingUp size={20} color="black" strokeWidth={2.5} />
            <Text className="text-lg font-semibold text-black">Focus Mode</Text>
          </Pressable>
        </View>

        {/* Recent Activity */}
        <View className="mt-6 px-4">
          <SectionHeader title="Recent Activity" actionText="View All" onAction={() => {}} />
          <View className="mt-2">
            {recentActivity.slice(0, 2).map((activity) => (
              <ActivityItem
                key={activity.id}
                contactName={activity.contactName}
                type={activity.type}
                content={activity.content}
                timestamp={activity.timestamp}
                onPress={() =>
                  router.push({
                    pathname: "/contact/[id]",
                    params: { id: activity.contactId },
                  })
                }
              />
            ))}
          </View>
        </View>

        {/* Upcoming Follow-ups */}
        <View className="mt-4 px-4">
          <SectionHeader title="Upcoming Follow-ups" />
          <View className="mt-2">
            {upcomingFollowUps.map((followUp) => {
              const contact = getContactById(followUp.contactId);
              return (
                <FollowUpItem
                  key={followUp.id}
                  title={followUp.title}
                  contactName={contact ? getContactFullName(contact) : "Unknown"}
                  dueDate={followUp.dueDate}
                  onPress={() =>
                    router.push({
                      pathname: "/contact/[id]",
                      params: { id: followUp.contactId },
                    })
                  }
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
