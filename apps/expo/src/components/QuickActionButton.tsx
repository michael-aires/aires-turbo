import { Pressable, Text } from "react-native";
import { Phone, MessageSquare, Mail } from "lucide-react-native";

interface QuickActionButtonProps {
  type: "call" | "sms" | "email";
  onPress?: () => void;
  variant?: "filled" | "outline";
}

const actionConfig = {
  call: { icon: Phone, label: "Call", color: "#34C759", bgColor: "bg-green-500/20" },
  sms: { icon: MessageSquare, label: "SMS", color: "#8E8E93", bgColor: "bg-gray-500/20" },
  email: { icon: Mail, label: "Email", color: "#8E8E93", bgColor: "bg-gray-500/20" },
};

export function QuickActionButton({ type, onPress, variant = "filled" }: QuickActionButtonProps) {
  const config = actionConfig[type];
  const IconComponent = config.icon;

  if (variant === "outline") {
    return (
      <Pressable
        onPress={onPress}
        className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full ${config.bgColor} py-2`}
      >
        <IconComponent size={14} color={config.color} />
        <Text style={{ color: config.color }} className="text-sm font-medium">
          {config.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className="h-12 w-12 items-center justify-center rounded-full"
      style={{ backgroundColor: config.color }}
    >
      <IconComponent size={20} color="white" />
    </Pressable>
  );
}

export function QuickActionRow({ onCall, onSMS, onEmail }: { onCall?: () => void; onSMS?: () => void; onEmail?: () => void }) {
  return (
    <>
      <QuickActionButton type="call" onPress={onCall} variant="outline" />
      <QuickActionButton type="sms" onPress={onSMS} variant="outline" />
      <QuickActionButton type="email" onPress={onEmail} variant="outline" />
    </>
  );
}
