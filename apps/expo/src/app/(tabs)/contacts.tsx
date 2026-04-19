import { useState, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LegendList } from "@legendapp/list";
import { Plus } from "lucide-react-native";
import { SearchBar, FilterPills, ContactCard } from "~/components";
import { contacts, filterContactsByStatus } from "~/data/mockData";
import type { LeadStatus } from "~/data/mockData";

type FilterOption = LeadStatus | "all";

const filterOptions: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All" },
  { value: "hot", label: "Hot" },
  { value: "qualified", label: "Qualified" },
  { value: "nurturing", label: "Nurturing" },
  { value: "new", label: "New" },
];

export default function Contacts() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("all");

  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Apply status filter
    if (selectedFilter !== "all") {
      result = filterContactsByStatus(selectedFilter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.firstName.toLowerCase().includes(searchLower) ||
          c.lastName.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower) ||
          c.phone.includes(searchQuery) ||
          c.company?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [searchQuery, selectedFilter]);

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4">
        <Text className="text-2xl font-bold text-white">Contacts</Text>
        <Pressable
          onPress={() => router.push("/contact/add")}
          className="flex-row items-center gap-1.5 rounded-full bg-[#F5A524] px-4 py-2"
        >
          <Plus size={16} color="black" strokeWidth={2.5} />
          <Text className="font-semibold text-black">Add</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View className="px-4 pb-3">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search contacts..."
        />
      </View>

      {/* Filters */}
      <View className="px-4 pb-4">
        <FilterPills
          options={filterOptions}
          selected={selectedFilter}
          onSelect={setSelectedFilter}
        />
      </View>

      {/* Contact List */}
      <LegendList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        estimatedItemSize={160}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => <ContactCard contact={item} />}
        ListEmptyComponent={() => (
          <View className="items-center justify-center py-12">
            <Text className="text-lg text-gray-400">No contacts found</Text>
            <Text className="mt-1 text-sm text-gray-500">
              Try adjusting your search or filters
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
