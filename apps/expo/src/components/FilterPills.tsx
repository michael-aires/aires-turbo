import { ScrollView, Pressable, Text } from "react-native";

interface FilterPillsProps<T extends string> {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}

export function FilterPills<T extends string>({ options, selected, onSelect }: FilterPillsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2"
    >
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            className={`rounded-full px-4 py-1.5 ${
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
    </ScrollView>
  );
}
