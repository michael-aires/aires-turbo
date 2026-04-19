import { useState } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  User,
  Settings,
  Clock,
  Eye,
  X,
  TrendingUp,
} from "lucide-react-native";
import { Avatar, StatusBadge } from "~/components";
import {
  getContactById,
  getContactInitials,
  getContactFullName,
  getFollowUpsForContact,
  aiInsights,
} from "~/data/mockData";

function QuickActionsModal({
  visible,
  onClose,
  contact,
  onCall,
  onSMS,
  onEmail,
  onMeeting,
  onViewProfile,
}: {
  visible: boolean;
  onClose: () => void;
  contact: { firstName: string; lastName: string; leadStatus: string; avatarColor: string };
  onCall: () => void;
  onSMS: () => void;
  onEmail: () => void;
  onMeeting: () => void;
  onViewProfile: () => void;
}) {
  const initials = `${contact.firstName[0]}${contact.lastName[0]}`;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable
        onPress={onClose}
        className="flex-1 justify-end bg-black/60"
      >
        <Pressable className="rounded-t-3xl bg-[#1C1C1E] p-4 pb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-white">Quick Actions</Text>
            <Pressable onPress={onClose}>
              <X size={24} color="#8E8E93" />
            </Pressable>
          </View>

          {/* Contact Info */}
          <View className="mb-4 flex-row items-center gap-3 border-b border-[#2C2C2E] pb-4">
            <Avatar initials={initials} color={contact.avatarColor} size="lg" />
            <View>
              <Text className="text-lg font-semibold text-white">
                {contact.firstName} {contact.lastName}
              </Text>
              <Text className="text-sm text-gray-400">{contact.leadStatus} \u2022 Buyer</Text>
            </View>
          </View>

          {/* Actions */}
          <View className="gap-2">
            <Pressable
              onPress={onCall}
              className="flex-row items-center gap-4 rounded-xl bg-[#2C2C2E] p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                <Phone size={20} color="#34C759" />
              </View>
              <View>
                <Text className="text-base font-medium text-white">Call</Text>
                <Text className="text-sm text-gray-400">000-000-0000</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onSMS}
              className="flex-row items-center gap-4 rounded-xl bg-[#2C2C2E] p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-gray-500/20">
                <MessageSquare size={20} color="#8E8E93" />
              </View>
              <View>
                <Text className="text-base font-medium text-white">Send SMS</Text>
                <Text className="text-sm text-gray-400">Quick message</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onEmail}
              className="flex-row items-center gap-4 rounded-xl bg-[#2C2C2E] p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                <Mail size={20} color="#007AFF" />
              </View>
              <View>
                <Text className="text-base font-medium text-white">Send Email</Text>
                <Text className="text-sm text-gray-400">john.smith@gmail.com</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onMeeting}
              className="flex-row items-center gap-4 rounded-xl bg-[#2C2C2E] p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-orange-500/20">
                <Calendar size={20} color="#F5A524" />
              </View>
              <View>
                <Text className="text-base font-medium text-white">Schedule Meeting</Text>
                <Text className="text-sm text-gray-400">Book a time slot</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onViewProfile}
              className="flex-row items-center gap-4 rounded-xl bg-[#2C2C2E] p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-gray-500/20">
                <User size={20} color="#8E8E93" />
              </View>
              <View>
                <Text className="text-base font-medium text-white">View Full Profile</Text>
                <Text className="text-sm text-gray-400">See complete details</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AssignWorkflowModal({
  visible,
  onClose,
  contact,
}: {
  visible: boolean;
  onClose: () => void;
  contact: { firstName: string; lastName: string; avatarColor: string };
}) {
  const [markComplete, setMarkComplete] = useState(true);
  const initials = `${contact.firstName[0]}${contact.lastName[0]}`;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable onPress={onClose} className="flex-1 bg-black/60">
        <SafeAreaView className="flex-1" edges={["top"]}>
          <View className="flex-1 pt-20">
            <Pressable className="flex-1 rounded-t-3xl bg-[#0A0A0A]">
              {/* Header */}
              <View className="flex-row items-center gap-3 px-4 py-3">
                <Pressable onPress={onClose}>
                  <ChevronLeft size={24} color="white" />
                </Pressable>
              </View>

              {/* Card */}
              <View className="mx-4 overflow-hidden rounded-xl">
                {/* Orange Header */}
                <View className="bg-[#F5A524] px-4 py-2">
                  <Text className="font-semibold text-black">Assign Cooper</Text>
                </View>

                {/* Content */}
                <View className="bg-[#1C1C1E] p-4">
                  {/* Contact Info */}
                  <View className="flex-row items-center gap-3">
                    <Avatar initials={initials} color={contact.avatarColor} size="lg" />
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-white">
                        {contact.firstName} {contact.lastName}
                      </Text>
                      <Text className="text-sm text-gray-400">Buyer</Text>
                    </View>
                    <View>
                      <Text className="text-right text-xs text-gray-400">000-000-0000</Text>
                      <Text className="text-right text-xs text-gray-400">
                        john.smith@gmail.com
                      </Text>
                    </View>
                  </View>

                  {/* Workflow */}
                  <View className="mt-4 flex-row items-center gap-3 rounded-xl bg-[#2C2C2E] p-3">
                    <Settings size={18} color="#8E8E93" />
                    <View>
                      <Text className="text-sm text-gray-400">Workflow</Text>
                      <Text className="text-base text-white">Send Email with Attachment</Text>
                    </View>
                  </View>

                  {/* User Approval */}
                  <View className="mt-3 flex-row items-center gap-3 rounded-xl bg-[#3A3A3C] p-3">
                    <Clock size={18} color="#8E8E93" />
                    <View>
                      <Text className="text-sm font-medium text-white">User Approval</Text>
                      <Text className="text-xs text-gray-400">Runs 1 min after approval</Text>
                    </View>
                  </View>

                  {/* Email Template */}
                  <View className="mt-4">
                    <Text className="text-base font-semibold text-white">
                      Send Email Template
                    </Text>
                    <Text className="mt-1 text-sm text-gray-400">Email: Pricing</Text>
                    <Text className="text-sm text-gray-400">Subject: Pricing for Pacifica</Text>
                    <Pressable className="mt-2 flex-row items-center gap-1">
                      <Eye size={14} color="#8E8E93" />
                      <Text className="text-sm text-gray-400">View Preview</Text>
                    </Pressable>
                  </View>

                  {/* Toggle */}
                  <View className="mt-4 flex-row items-center justify-between">
                    <Text className="text-base text-white">Mark task complete</Text>
                    <Pressable
                      onPress={() => setMarkComplete(!markComplete)}
                      className={`h-7 w-12 rounded-full p-0.5 ${markComplete ? "bg-[#F5A524]" : "bg-[#3A3A3C]"}`}
                    >
                      <View
                        className={`h-6 w-6 rounded-full bg-white ${markComplete ? "ml-auto" : ""}`}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Confirm Button */}
              <View className="mx-4 mt-4">
                <Pressable
                  onPress={onClose}
                  className="items-center rounded-xl bg-white py-4"
                >
                  <Text className="text-base font-semibold text-black">
                    Confirm & Execute
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

export default function FocusModeDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);

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
  const followUps = getFollowUpsForContact(contact.id);
  const currentTask = followUps.find((f) => !f.completed);

  const handleCall = () => {
    setShowQuickActions(false);
    router.push({
      pathname: "/call/[id]",
      params: { id: contact.id },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <ChevronLeft size={24} color="white" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        {/* Contact Card */}
        <View className="mx-4 rounded-xl bg-[#1C1C1E] p-4">
          {/* Contact Header */}
          <View className="flex-row items-start gap-3">
            <Avatar initials={initials} color={contact.avatarColor} size="lg" />
            <View className="flex-1">
              <Text className="text-xl font-bold text-white">{fullName}</Text>
              <Text className="text-sm text-gray-400">Buyer</Text>
            </View>
            <View className="items-end">
              <Text className="text-xs text-gray-400">{contact.phone}</Text>
              <Text className="text-xs text-gray-400">{contact.email}</Text>
            </View>
          </View>

          {/* Lead Score */}
          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-sm text-gray-400">Lead Score</Text>
            <Text className="text-base font-semibold text-white">B 75/100</Text>
          </View>
          <View className="mt-2 h-2 overflow-hidden rounded-full bg-[#2C2C2E]">
            <View className="h-full w-3/4 rounded-full bg-[#34C759]" />
          </View>

          {/* Trend */}
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-sm text-gray-400">Trend</Text>
            <View className="flex-row items-center gap-1">
              <TrendingUp size={14} color="#34C759" />
              <Text className="text-sm text-[#34C759]">Improving</Text>
            </View>
          </View>

          {/* AI Analysis */}
          <View className="mt-4">
            <View className="flex-row items-center gap-2">
              <Settings size={16} color="#8E8E93" />
              <Text className="text-sm font-semibold text-white">AI Analysis</Text>
            </View>
            <Text className="mt-2 text-sm text-gray-400">
              Michael has visited the site multiple times, received two email
              campaigns, and completed an outbound call. Next step is a
              presentation center visit booked for tomorrow.
            </Text>
          </View>

          {/* Current Task */}
          {currentTask && (
            <View className="mt-4 rounded-xl bg-[#2C2C2E] p-3">
              <Text className="text-base font-medium text-white">
                {currentTask.title}
              </Text>
              <Text className="mt-0.5 text-xs text-[#F5A524]">Due Today</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={() => setShowWorkflow(true)}
              className="flex-1 items-center rounded-xl bg-[#F5A524] py-3"
            >
              <Text className="font-semibold text-black">Assign Cooper</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowQuickActions(true)}
              className="flex-1 items-center rounded-xl bg-[#F5A524] py-3"
            >
              <Text className="font-semibold text-black">Take Action</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <QuickActionsModal
        visible={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        contact={contact}
        onCall={handleCall}
        onSMS={() => setShowQuickActions(false)}
        onEmail={() => setShowQuickActions(false)}
        onMeeting={() => setShowQuickActions(false)}
        onViewProfile={() => {
          setShowQuickActions(false);
          router.push({
            pathname: "/contact/[id]",
            params: { id: contact.id },
          });
        }}
      />

      <AssignWorkflowModal
        visible={showWorkflow}
        onClose={() => setShowWorkflow(false)}
        contact={contact}
      />
    </SafeAreaView>
  );
}
