import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import type { LeadStatus, PropertyType } from "~/data/mockData";

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "hot", label: "Hot" },
  { value: "qualified", label: "Qualified" },
  { value: "nurturing", label: "Nurturing" },
  { value: "cold", label: "Cold" },
];

const propertyOptions: { value: PropertyType; label: string }[] = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "land", label: "Land" },
  { value: "industrial", label: "Industrial" },
];

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  required,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  required?: boolean;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm text-gray-400">
        {label}
        {required && <Text className="text-red-500"> *</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#3A3A3C"
        keyboardType={keyboardType}
        className="rounded-xl bg-[#1C1C1E] px-4 py-3 text-base text-white"
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
      />
    </View>
  );
}

function FormSelect<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (value: T) => void;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm text-gray-400">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onSelect(option.value)}
                className={`rounded-full px-4 py-2 ${
                  isSelected ? "bg-[#F5A524]" : "bg-[#1C1C1E]"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isSelected ? "text-black" : "text-white"
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export default function AddContact() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("new");
  const [propertyType, setPropertyType] = useState<PropertyType>("residential");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [notes, setNotes] = useState("");

  const canSave = firstName.trim() && lastName.trim();

  const handleSave = () => {
    // In a real app, this would save to the database
    // For now, just navigate back
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-[#1C1C1E] px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <X size={24} color="#8E8E93" />
        </Pressable>
        <Text className="text-lg font-semibold text-white">Add Lead</Text>
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className={`rounded-full px-4 py-1.5 ${canSave ? "bg-[#F5A524]" : "bg-[#1C1C1E]"}`}
        >
          <Text
            className={`font-semibold ${canSave ? "text-black" : "text-gray-500"}`}
          >
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4 pb-8">
        {/* Basic Info */}
        <View className="gap-4">
          <Text className="text-lg font-semibold text-white">Basic Information</Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormInput
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="John"
                required
              />
            </View>
            <View className="flex-1">
              <FormInput
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Smith"
                required
              />
            </View>
          </View>
          <FormInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="john@example.com"
            keyboardType="email-address"
          />
          <FormInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+1-555-0123"
            keyboardType="phone-pad"
          />
          <FormInput
            label="Company"
            value={company}
            onChangeText={setCompany}
            placeholder="Acme Corp"
          />
        </View>

        {/* Lead Info */}
        <View className="mt-4 gap-4">
          <Text className="text-lg font-semibold text-white">Lead Information</Text>
          <FormSelect
            label="Lead Status"
            value={leadStatus}
            options={statusOptions}
            onSelect={setLeadStatus}
          />
          <FormSelect
            label="Property Type"
            value={propertyType}
            options={propertyOptions}
            onSelect={setPropertyType}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormInput
                label="Budget Min"
                value={budgetMin}
                onChangeText={setBudgetMin}
                placeholder="$500,000"
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <FormInput
                label="Budget Max"
                value={budgetMax}
                onChangeText={setBudgetMax}
                placeholder="$1,000,000"
                keyboardType="numeric"
              />
            </View>
          </View>
          <FormInput
            label="Preferred Location"
            value={preferredLocation}
            onChangeText={setPreferredLocation}
            placeholder="Downtown, Suburbs, etc."
          />
        </View>

        {/* Notes */}
        <View className="mt-4 gap-4">
          <Text className="text-lg font-semibold text-white">Notes</Text>
          <View className="gap-1.5">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this lead..."
              placeholderTextColor="#3A3A3C"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="min-h-[120px] rounded-xl bg-[#1C1C1E] px-4 py-3 text-base text-white"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
