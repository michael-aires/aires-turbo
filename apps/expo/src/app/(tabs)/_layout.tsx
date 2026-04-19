import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import {
  Home,
  Users,
  Phone,
  MessageSquare,
  Mail,
} from "lucide-react-native";

const TAB_BAR_HEIGHT = 85;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0A0A0A",
          borderTopColor: "#1C1C1E",
          borderTopWidth: 1,
          height: TAB_BAR_HEIGHT,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarActiveTintColor: "#F5A524",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Contacts",
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: "Calls",
          tabBarIcon: ({ color, size }) => (
            <Phone size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => (
            <MessageSquare size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="email"
        options={{
          title: "Email",
          tabBarIcon: ({ color, size }) => (
            <Mail size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
