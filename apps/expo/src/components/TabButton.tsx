import { View, Pressable, Text } from "react-native";

interface TabButtonProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TabButton({ tabs, activeTab, onTabChange }: TabButtonProps) {
  return (
    <View className="flex-row gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            className={`flex-1 items-center rounded-full py-2.5 ${
              isActive ? "bg-white" : "bg-[#1C1C1E]"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                isActive ? "text-black" : "text-gray-400"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
