// Mock data for Real Estate CRM

export type LeadStatus = "hot" | "qualified" | "nurturing" | "new" | "cold" | "won" | "lost";
export type PropertyType = "residential" | "commercial" | "land" | "industrial";
export type CommunicationType = "call" | "sms" | "email";
export type CommunicationDirection = "inbound" | "outbound";

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
  jobTitle?: string;
  leadStatus: LeadStatus;
  leadSource?: string;
  budgetMin?: number;
  budgetMax?: number;
  propertyType?: PropertyType;
  preferredLocation?: string;
  notes?: string;
  avatarColor: string;
  createdAt: Date;
  lastContactedAt?: Date;
}

export interface Communication {
  id: string;
  contactId: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  content: string;
  timestamp: Date;
  duration?: number; // for calls, in seconds
  transcript?: string;
}

export interface FollowUp {
  id: string;
  contactId: string;
  title: string;
  description?: string;
  dueDate: Date;
  completed: boolean;
  actionType: "call" | "email" | "meeting" | "task";
}

export interface CallScript {
  id: string;
  title: string;
  steps: string[];
}

// Avatar colors based on initials
const avatarColors: Record<string, string> = {
  MC: "#007AFF", // Blue
  LW: "#5856D6", // Purple
  JS: "#AF544A", // Brown/Red
  AB: "#AF544A", // Brown/Red
  TK: "#34C759", // Green
  ER: "#34C759", // Green
  SJ: "#FF9500", // Orange
  MM: "#8E8E93", // Gray
};

// Sample contacts
export const contacts: Contact[] = [
  {
    id: "1",
    firstName: "Michael",
    lastName: "Chen",
    email: "michael.chen@startup.com",
    phone: "+1-555-0124",
    company: "Chen Ventures",
    leadStatus: "qualified",
    budgetMin: 1500000,
    budgetMax: 3000000,
    propertyType: "commercial",
    preferredLocation: "Business district",
    notes: "Expanding startup looking for office space for 50+ employees.",
    avatarColor: avatarColors.MC ?? "#007AFF",
    createdAt: new Date("2024-08-15"),
    lastContactedAt: new Date("2024-09-29"),
  },
  {
    id: "2",
    firstName: "Lisa",
    lastName: "Wang",
    email: "lisa.wang@globalcorp.com",
    phone: "+1-555-0127",
    company: "Global Corp",
    leadStatus: "qualified",
    budgetMin: 1000000,
    budgetMax: 1500000,
    propertyType: "residential",
    preferredLocation: "Suburban area",
    avatarColor: avatarColors.LW ?? "#5856D6",
    createdAt: new Date("2024-07-20"),
    lastContactedAt: new Date("2024-09-28"),
  },
  {
    id: "3",
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@gmail.com",
    phone: "000-000-0000",
    leadStatus: "hot",
    propertyType: "residential",
    notes: "Looking for family home, 4+ bedrooms",
    avatarColor: avatarColors.JS ?? "#AF544A",
    createdAt: new Date("2024-09-01"),
    lastContactedAt: new Date("2024-10-01"),
  },
  {
    id: "4",
    firstName: "Ana",
    lastName: "Bell",
    email: "ana.bell@email.com",
    phone: "+1-555-0128",
    leadStatus: "qualified",
    propertyType: "residential",
    avatarColor: avatarColors.AB ?? "#AF544A",
    createdAt: new Date("2024-08-25"),
  },
  {
    id: "5",
    firstName: "Tom",
    lastName: "King",
    email: "tom.king@business.com",
    phone: "+1-555-0129",
    leadStatus: "nurturing",
    propertyType: "residential",
    avatarColor: avatarColors.TK ?? "#34C759",
    createdAt: new Date("2024-09-10"),
  },
  {
    id: "6",
    firstName: "Emily",
    lastName: "Rodriguez",
    email: "emily.r@email.com",
    phone: "+1-555-0125",
    leadStatus: "nurturing",
    budgetMin: 400000,
    budgetMax: 600000,
    propertyType: "residential",
    avatarColor: avatarColors.ER ?? "#34C759",
    createdAt: new Date("2024-09-05"),
  },
  {
    id: "7",
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.j@techsolutions.com",
    phone: "+1-555-0123",
    company: "Tech Solutions Inc",
    leadStatus: "hot",
    budgetMin: 800000,
    budgetMax: 1200000,
    propertyType: "residential",
    avatarColor: avatarColors.SJ ?? "#FF9500",
    createdAt: new Date("2024-09-15"),
    lastContactedAt: new Date("2024-10-01"),
  },
];

// Sample communications
export const communications: Communication[] = [
  {
    id: "c1",
    contactId: "1",
    type: "email",
    direction: "outbound",
    content: "Hi Michael, I found several commercial spaces that match your requirements. Would you like to schedule a tour?",
    timestamp: new Date("2024-09-29T01:17:00"),
  },
  {
    id: "c2",
    contactId: "3",
    type: "call",
    direction: "outbound",
    content: "Discussed property viewing schedule",
    timestamp: new Date("2024-10-01T10:30:00"),
    duration: 420,
    transcript: "Hi Sarah, this is John from Smith Realty. I hope I'm not catching you at a bad time?\n\nOh hi John! No, not at all. I was actually just thinking about calling you back.\n\nPerfect! I wanted to follow up on the property we discussed last week. Have you had a chance to think about our conversation?",
  },
  {
    id: "c3",
    contactId: "7",
    type: "sms",
    direction: "inbound",
    content: "Hi! Yes, I'm still interested in the downtown property. When can we schedule a viewing?",
    timestamp: new Date("2024-10-01T09:15:00"),
  },
  {
    id: "c4",
    contactId: "2",
    type: "email",
    direction: "outbound",
    content: "Following up on your inquiry about residential properties in the suburban area.",
    timestamp: new Date("2024-09-28T14:00:00"),
  },
];

// Sample follow-ups
export const followUps: FollowUp[] = [
  {
    id: "f1",
    contactId: "7",
    title: "Property Viewing Follow-up",
    description: "Follow up after the downtown property viewing",
    dueDate: new Date("2025-10-01"),
    completed: false,
    actionType: "call",
  },
  {
    id: "f2",
    contactId: "1",
    title: "Investment Property Details",
    description: "Send detailed information about commercial investment properties",
    dueDate: new Date("2025-10-01"),
    completed: false,
    actionType: "email",
  },
  {
    id: "f3",
    contactId: "1",
    title: "Send Commercial Listings",
    description: "Send updated commercial listings for the business district",
    dueDate: new Date("2025-10-02"),
    completed: false,
    actionType: "email",
  },
  {
    id: "f4",
    contactId: "3",
    title: "Follow up on pricing",
    description: "Discuss pricing options for the property",
    dueDate: new Date(), // Today
    completed: false,
    actionType: "call",
  },
  {
    id: "f5",
    contactId: "4",
    title: "Pricing",
    description: "Send pricing information",
    dueDate: new Date(), // Today
    completed: false,
    actionType: "email",
  },
  {
    id: "f6",
    contactId: "5",
    title: "Call back",
    description: "Return call from yesterday",
    dueDate: new Date(), // Today
    completed: false,
    actionType: "call",
  },
];

// Sample recent activity
export const recentActivity = [
  {
    id: "a1",
    contactId: "8",
    contactName: "Michael Moll",
    type: "sms" as CommunicationType,
    content: "hi",
    timestamp: new Date(Date.now() - 14 * 60 * 1000), // 14 minutes ago
  },
  {
    id: "a2",
    contactId: "8",
    contactName: "Michael Moll",
    type: "sms" as CommunicationType,
    content: "good",
    timestamp: new Date("2024-10-01"),
  },
];

// Call scripts
export const callScripts: CallScript[] = [
  {
    id: "s1",
    title: "Initial Contact Script",
    steps: [
      "approval letter handy. Do you already have financing lined up?",
      "[00:00:52] Sarah: We got pre-approved last month, so yes, we're all set on that front.",
      "[00:00:56] John: Excellent! That puts you in a really strong position. This property has been getting a lot of interest, so having your financing ready is a huge advantage.",
      "[00:01:03] Sarah: That's good to know. We",
    ],
  },
];

// AI Insights for calls
export const aiInsights = {
  overallSentiment: 82,
  sentimentLabel: "Positive",
  emotions: [
    { name: "Enthusiasm", value: 88, color: "#34C759" },
    { name: "Trust", value: 79, color: "#007AFF" },
    { name: "Urgency", value: 65, color: "#FF9500" },
    { name: "Concern", value: 23, color: "#FF3B30" },
  ],
  recommendations: [
    "Schedule viewing immediately while interest is high",
    "Prepare competitive analysis for potential negotiation",
    "Send school district information to reinforce value prop",
    "Follow up within 24 hours to maintain momentum",
  ],
};

// Helper functions
export function getContactById(id: string): Contact | undefined {
  return contacts.find((c) => c.id === id);
}

export function getContactInitials(contact: Contact): string {
  return `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();
}

export function getContactFullName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName}`;
}

export function getCommunicationsForContact(contactId: string): Communication[] {
  return communications.filter((c) => c.contactId === contactId);
}

export function getFollowUpsForContact(contactId: string): FollowUp[] {
  return followUps.filter((f) => f.contactId === contactId);
}

export function formatBudgetRange(min?: number, max?: number): string {
  if (!min && !max) return "Not specified";
  const formatNum = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
    return `$${n}`;
  };
  if (min && max) return `${formatNum(min)}-${formatNum(max)}`;
  if (min) return `${formatNum(min)}+`;
  return `Up to ${formatNum(max!)}`;
}

export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "2-digit",
    year: "numeric",
  });
}

// Dashboard metrics
export function getDashboardMetrics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    totalContacts: contacts.length,
    hotLeads: contacts.filter((c) => c.leadStatus === "hot").length,
    callsToday: communications.filter(
      (c) => c.type === "call" && c.timestamp >= today
    ).length,
    followUpsDue: followUps.filter((f) => !f.completed && f.dueDate <= new Date()).length,
  };
}

// Filter contacts by status
export function filterContactsByStatus(status: LeadStatus | "all"): Contact[] {
  if (status === "all") return contacts;
  return contacts.filter((c) => c.leadStatus === status);
}

// Search contacts
export function searchContacts(query: string): Contact[] {
  const lowerQuery = query.toLowerCase();
  return contacts.filter(
    (c) =>
      c.firstName.toLowerCase().includes(lowerQuery) ||
      c.lastName.toLowerCase().includes(lowerQuery) ||
      c.email.toLowerCase().includes(lowerQuery) ||
      c.phone.includes(query) ||
      c.company?.toLowerCase().includes(lowerQuery)
  );
}
