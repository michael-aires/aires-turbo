import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  Pencil,
  Phone,
  MessageSquare,
  Mail,
  Building2,
  DollarSign,
  Home,
  MapPin,
} from "lucide-react-native";
import { Avatar, StatusBadge } from "~/components";
import {
  getContactById,
  getContactInitials,
  getContactFullName,
  getCommunicationsForContact,
  formatBudgetRange,
  formatTimeAgo,
} from "~/data/mockData";

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-[#1C1C1E] p-4">
      <Icon size={20} color="#8E8E93" />
      <View className="flex-1">
        <Text className="text-xs text-gray-500">{label}</Text>
        <Text className="text-base text-white">{value}</Text>
      </View>
    </View>
  );
}

export default function ContactDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const contact = getContactById(id);
  if (!contact) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#0A0A0A]">
        <Text className="text-lg text-gray-400">Contact not found</Text>
      </SafeAreaView>
    );
  }

  const initials = getContactInitials(contact);
  const fullName = getContactFullName(contact);
  const communications = getCommunicationsForContact(contact.id);

  const handleCall = () => {
    router.push({
      pathname: "/call/[id]",
      params: { id: contact.id },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1"
        >
          <ChevronLeft size={24} color="#F5A524" />
          <Text className="text-lg text-white">{fullName}</Text>
        </Pressable>
        <Pressable className="rounded-full bg-[#F5A524] p-2">
          <Pencil size={18} color="black" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        {/* Profile Header */}
        <View className="items-center px-4 py-6">
          <Avatar initials={initials} color={contact.avatarColor} size="xl" />
          <Text className="mt-3 text-2xl font-bold text-white">{fullName}</Text>
          <View className="mt-2">
            <StatusBadge status={contact.leadStatus} size="md" />
          </View>

          {/* Quick Actions */}
          <View className="mt-6 flex-row gap-4">
            <Pressable
              onPress={handleCall}
              className="h-14 w-14 items-center justify-center rounded-full bg-[#34C759]"
            >
              <Phone size={24} color="white" />
            </Pressable>
            <Pressable className="h-14 w-14 items-center justify-center rounded-full bg-[#F5A524]">
              <MessageSquare size={24} color="white" />
            </Pressable>
            <Pressable className="h-14 w-14 items-center justify-center rounded-full bg-[#007AFF]">
              <Mail size={24} color="white" />
            </Pressable>
          </View>
        </View>

        {/* Contact Information */}
        <View className="px-4">
          <Text className="mb-3 text-lg font-semibold text-white">
            Contact Information
          </Text>
          <View className="gap-2">
            <InfoCard icon={Phone} label="Phone" value={contact.phone} />
            <InfoCard icon={Mail} label="Email" value={contact.email} />
            {contact.company && (
              <InfoCard icon={Building2} label="Company" value={contact.company} />
            )}
            {(contact.budgetMin ?? contact.budgetMax) && (
              <InfoCard
                icon={DollarSign}
                label="Budget Range"
                value={formatBudgetRange(contact.budgetMin, contact.budgetMax)}
              />
            )}
            {contact.propertyType && (
              <InfoCard
                icon={Home}
                label="Property Type"
                value={contact.propertyType}
              />
            )}
            {contact.preferredLocation && (
              <InfoCard
                icon={MapPin}
                label="Preferred Location"
                value={contact.preferredLocation}
              />
            )}
          </View>
        </View>

        {/* Notes */}
        {contact.notes && (
          <View className="mt-6 px-4">
            <Text className="mb-3 text-lg font-semibold text-white">Notes</Text>
            <View className="rounded-xl bg-[#1C1C1E] p-4">
              <Text className="text-base text-gray-300">{contact.notes}</Text>
            </View>
          </View>
        )}

        {/* Communication History */}
        {communications.length > 0 && (
          <View className="mt-6 px-4">
            <Text className="mb-3 text-lg font-semibold text-white">
              Communication History
            </Text>
            <View className="gap-2">
              {communications.map((comm) => (
                <View key={comm.id} className="rounded-xl bg-[#1C1C1E] p-4">
                  <View className="flex-row items-center gap-2">
                    {comm.type === "email" && <Mail size={16} color="#007AFF" />}
                    {comm.type === "sms" && <MessageSquare size={16} color="#8E8E93" />}
                    {comm.type === "call" && <Phone size={16} color="#34C759" />}
                    <Text className="text-sm font-medium text-white">
                      {comm.type.charAt(0).toUpperCase() + comm.type.slice(1)} \u2022{" "}
                      {comm.direction.charAt(0).toUpperCase() + comm.direction.slice(1)}
                    </Text>
                    <Text className="ml-auto text-xs text-gray-500">
                      {formatTimeAgo(comm.timestamp)}
                    </Text>
                  </View>
                  <Text className="mt-2 text-sm text-gray-400" numberOfLines={3}>
                    {comm.content}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
