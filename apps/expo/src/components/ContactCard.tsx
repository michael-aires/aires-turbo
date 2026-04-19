import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";
import { QuickActionRow } from "./QuickActionButton";
import type { Contact } from "~/data/mockData";
import { getContactInitials, formatBudgetRange } from "~/data/mockData";

interface ContactCardProps {
  contact: Contact;
}

export function ContactCard({ contact }: ContactCardProps) {
  const router = useRouter();
  const initials = getContactInitials(contact);

  const handlePress = () => {
    router.push({
      pathname: "/contact/[id]",
      params: { id: contact.id },
    });
  };

  const handleCall = () => {
    router.push({
      pathname: "/call/[id]",
      params: { id: contact.id },
    });
  };

  return (
    <Pressable onPress={handlePress} className="rounded-xl bg-[#1C1C1E] p-4">
      <View className="flex-row items-start gap-3">
        <Avatar initials={initials} color={contact.avatarColor} size="lg" />
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-white">
              {contact.firstName} {contact.lastName}
            </Text>
            <StatusBadge status={contact.leadStatus} />
          </View>
          <Text className="mt-0.5 text-sm text-gray-400">
            {contact.company ? `${contact.company} \u2022 ` : ""}
            {contact.phone}
          </Text>
          {(contact.propertyType ?? contact.budgetMin ?? contact.budgetMax) && (
            <Text className="mt-0.5 text-sm text-gray-500">
              {contact.propertyType}
              {contact.propertyType && (contact.budgetMin ?? contact.budgetMax) ? " \u2022 " : ""}
              {formatBudgetRange(contact.budgetMin, contact.budgetMax)}
            </Text>
          )}
        </View>
      </View>
      <View className="mt-3 flex-row gap-2">
        <QuickActionRow
          onCall={handleCall}
          onSMS={undefined}
          onEmail={undefined}
        />
      </View>
    </Pressable>
  );
}
