import { View, TextInput } from "react-native";
import { Search } from "lucide-react-native";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = "Search contacts..." }: SearchBarProps) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-[#1C1C1E] px-3 py-2.5">
      <Search size={18} color="#8E8E93" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8E8E93"
        className="flex-1 text-base text-white"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
