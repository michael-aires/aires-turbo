import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  UserPlus,
  MessageSquare,
  X,
} from "lucide-react-native";
import { Avatar } from "~/components";
import {
  getContactById,
  getContactInitials,
  getContactFullName,
  callScripts,
  aiInsights,
} from "~/data/mockData";

type CallTab = "live" | "script" | "insights";

const tabs: { key: CallTab; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "script", label: "Script" },
  { key: "insights", label: "AI Insights" },
];

// Mock live transcript
const liveTranscript = [
  {
    speaker: "You",
    timestamp: "02:23:44 AM",
    text: "Hi Sarah, this is John from Smith Realty. I hope I'm not catching you at a bad time?",
  },
  {
    speaker: "Michael Moll",
    timestamp: "02:23:54 AM",
    text: "Oh hi John! No, not at all. I was actually just thinking about calling you back.",
  },
  {
    speaker: "You",
    timestamp: "02:24:04 AM",
    text: "Perfect! I wanted to follow up on the property we discussed last week. Have you had a chance to think about our conversation?",
  },
];

function EmotionBar({ name, value, color }: { name: string; value: number; color: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <Text className="w-24 text-sm text-gray-400">{name}</Text>
      <View className="h-2 flex-1 overflow-hidden rounded-full bg-[#2C2C2E]">
        <View
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </View>
      <Text className="w-10 text-right text-sm text-gray-400">{value}%</Text>
    </View>
  );
}

export default function ActiveCall() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<CallTab>("live");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [callTime, setCallTime] = useState(0);

  const contact = getContactById(id);

  // Simulate call timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCallTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!contact) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#0A1628]">
        <Text className="text-lg text-gray-400">Contact not found</Text>
      </SafeAreaView>
    );
  }

  const initials = getContactInitials(contact);
  const fullName = getContactFullName(contact);

  const handleEndCall = () => {
    router.back();
  };

  return (
    <View className="flex-1 bg-[#0A1628]">
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Call Info */}
        <View className="items-center pt-8">
          <Text className="text-lg text-gray-400">{formatTime(callTime)}</Text>
          <Text className="mt-2 text-3xl font-bold text-white">{fullName}</Text>
          <Text className="mt-1 text-base text-gray-400">{contact.phone}</Text>
        </View>

        {/* Avatar (faded in background) */}
        <View className="absolute left-1/2 top-40 -ml-16 opacity-10">
          <Avatar initials={initials} color={contact.avatarColor} size="xl" />
        </View>

        {/* Bottom Panel */}
        <View className="mt-auto">
          {/* Tab Content Card */}
          <View className="mx-4 overflow-hidden rounded-2xl bg-[#1C2836]">
            {/* Tabs */}
            <View className="flex-row border-b border-[#2C3846]">
              {tabs.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    className={`flex-1 flex-row items-center justify-center gap-1.5 py-3 ${
                      isActive ? "border-b-2 border-[#007AFF]" : ""
                    }`}
                  >
                    {tab.key === "live" && (
                      <MessageSquare size={14} color={isActive ? "#007AFF" : "#8E8E93"} />
                    )}
                    {tab.key === "script" && (
                      <View className="h-3.5 w-3.5 items-center justify-center rounded bg-[#34C759]">
                        <Text className="text-[8px] font-bold text-white">S</Text>
                      </View>
                    )}
                    {tab.key === "insights" && (
                      <View className="relative">
                        <View className="h-3.5 w-3.5 items-center justify-center rounded-full border border-[#007AFF]">
                          <Text className="text-[8px] text-[#007AFF]">AI</Text>
                        </View>
                        <View className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#F5A524]" />
                      </View>
                    )}
                    <Text
                      className={`text-sm font-medium ${
                        isActive ? "text-[#007AFF]" : "text-gray-400"
                      }`}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable className="px-3 py-3">
                <X size={18} color="#8E8E93" />
              </Pressable>
            </View>

            {/* Tab Content */}
            <ScrollView className="max-h-64 p-4">
              {activeTab === "live" && (
                <View className="gap-4">
                  {liveTranscript.map((item, index) => (
                    <View key={index}>
                      <View className="flex-row items-center gap-2">
                        <Text
                          className={`text-sm font-semibold ${
                            item.speaker === "You" ? "text-red-400" : "text-[#007AFF]"
                          }`}
                        >
                          {item.speaker}
                        </Text>
                        <Text className="text-xs text-gray-500">{item.timestamp}</Text>
                      </View>
                      <Text className="mt-1 font-mono text-sm text-gray-300">
                        {item.text}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {activeTab === "script" && (
                <View className="gap-3">
                  {callScripts[0]?.steps.map((step, index) => (
                    <Text key={index} className="font-mono text-sm text-gray-300">
                      {step}
                    </Text>
                  ))}
                </View>
              )}

              {activeTab === "insights" && (
                <View>
                  {/* Sentiment Score */}
                  <View className="items-center">
                    <View className="relative h-32 w-32">
                      {/* Circular progress background */}
                      <View className="absolute inset-0 items-center justify-center rounded-full border-8 border-[#2C3846]">
                        <Text className="text-4xl font-bold text-white">
                          {aiInsights.overallSentiment}%
                        </Text>
                        <Text className="text-sm text-[#34C759]">
                          {aiInsights.sentimentLabel}
                        </Text>
                      </View>
                      {/* Progress arc (simplified) */}
                      <View
                        className="absolute inset-0 rounded-full border-8 border-[#34C759]"
                        style={{
                          borderRightColor: "transparent",
                          borderBottomColor: "transparent",
                          transform: [{ rotate: "45deg" }],
                        }}
                      />
                    </View>
                    <Text className="mt-3 text-sm text-gray-400">
                      Overall Sentiment Score
                    </Text>
                  </View>

                  {/* Emotion Analysis */}
                  <View className="mt-6">
                    <Text className="mb-3 text-base font-semibold text-white">
                      Emotion Analysis
                    </Text>
                    <View className="gap-3">
                      {aiInsights.emotions.map((emotion) => (
                        <EmotionBar
                          key={emotion.name}
                          name={emotion.name}
                          value={emotion.value}
                          color={emotion.color}
                        />
                      ))}
                    </View>
                  </View>

                  {/* Recommendations */}
                  <View className="mt-6">
                    <Text className="mb-3 text-base font-semibold text-white">
                      Recommendations
                    </Text>
                    <View className="gap-2">
                      {aiInsights.recommendations.map((rec, index) => (
                        <View
                          key={index}
                          className="rounded-lg border-l-2 border-[#007AFF] bg-[#2C3846] p-3"
                        >
                          <Text className="text-sm text-gray-300">
                            {index + 1}. {rec}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Call Controls */}
          <View className="items-center pb-8 pt-6">
            {/* Main Controls */}
            <View className="flex-row items-center gap-6">
              <Pressable
                onPress={() => setIsMuted(!isMuted)}
                className={`h-14 w-14 items-center justify-center rounded-full ${
                  isMuted ? "bg-white" : "bg-[#2C3846]"
                }`}
              >
                {isMuted ? (
                  <MicOff size={24} color="#0A1628" />
                ) : (
                  <Mic size={24} color="white" />
                )}
              </Pressable>

              <Pressable
                onPress={handleEndCall}
                className="h-16 w-16 items-center justify-center rounded-full bg-[#FF3B30]"
              >
                <PhoneOff size={28} color="white" />
              </Pressable>

              <Pressable
                onPress={() => setIsSpeaker(!isSpeaker)}
                className={`h-14 w-14 items-center justify-center rounded-full ${
                  isSpeaker ? "bg-[#34C759]" : "bg-[#2C3846]"
                }`}
              >
                {isSpeaker ? (
                  <Volume2 size={24} color="white" />
                ) : (
                  <VolumeX size={24} color="white" />
                )}
              </Pressable>
            </View>

            {/* Secondary Controls */}
            <View className="mt-4 flex-row items-center gap-4">
              <Pressable className="h-12 w-12 items-center justify-center rounded-full bg-[#2C3846]">
                <UserPlus size={20} color="#8E8E93" />
              </Pressable>
              <Pressable className="h-12 w-12 items-center justify-center rounded-full bg-[#34C759]">
                <MessageSquare size={20} color="white" />
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
