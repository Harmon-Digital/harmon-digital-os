import {
  DollarSign,
  Receipt,
  Target,
  Trophy,
  Handshake,
  Calendar,
  Users,
  Clock,
  CheckSquare,
  FolderKanban,
} from "lucide-react";

export const KPI_CATEGORIES = [
  { value: "all", label: "All" },
  { value: "revenue", label: "Revenue" },
  { value: "leads", label: "Leads" },
  { value: "social", label: "Social" },
  { value: "operations", label: "Operations" },
];

export const KPI_DEFINITIONS = [
  // Revenue
  {
    slug: "revenue_paid",
    name: "Revenue (Paid)",
    category: "revenue",
    unit: "currency",
    calcType: "auto",
    icon: DollarSign,
    color: "green",
    hero: true,
    source: { table: "invoices", filter: { status: "paid" }, aggregate: "sum", field: "total", dateField: "issue_date" },
    perMember: false,
  },
  {
    slug: "revenue_invoiced",
    name: "Revenue (Invoiced)",
    category: "revenue",
    unit: "currency",
    calcType: "auto",
    icon: Receipt,
    color: "emerald",
    source: { table: "invoices", filter: {}, aggregate: "sum", field: "total", dateField: "issue_date" },
    perMember: false,
  },

  // Leads
  {
    slug: "new_leads",
    name: "New Leads",
    category: "leads",
    unit: "number",
    calcType: "auto",
    icon: Target,
    color: "blue",
    hero: true,
    source: { table: "leads", filter: {}, aggregate: "count", dateField: "created_at" },
    perMember: true,
    memberField: "assigned_to",
  },
  {
    slug: "won_deals",
    name: "Won Deals",
    category: "leads",
    unit: "number",
    calcType: "auto",
    icon: Trophy,
    color: "indigo",
    hero: true,
    source: { table: "leads", filter: { status: "won" }, aggregate: "count", dateField: "updated_at" },
    perMember: true,
    memberField: "assigned_to",
  },
  {
    slug: "brokers_contacted",
    name: "Broker Outreach",
    category: "leads",
    unit: "number",
    calcType: "auto",
    icon: Handshake,
    color: "purple",
    source: { table: "broker_activities", filter: {}, aggregate: "count", dateField: "created_at" },
    perMember: true,
    memberField: "team_member_id",
  },

  // Social
  {
    slug: "social_posts",
    name: "Social Posts",
    category: "social",
    unit: "number",
    calcType: "auto",
    icon: Calendar,
    color: "pink",
    hero: true,
    source: { table: "social_posts", filter: { status: "published" }, aggregate: "count", dateField: "scheduled_date" },
    perMember: true,
    memberField: "assigned_to",
  },
  {
    slug: "ig_followers",
    name: "Instagram Followers",
    category: "social",
    unit: "number",
    calcType: "manual",
    icon: Users,
    color: "rose",
    perMember: false,
  },
  {
    slug: "li_followers",
    name: "LinkedIn Followers",
    category: "social",
    unit: "number",
    calcType: "manual",
    icon: Users,
    color: "sky",
    perMember: false,
  },

  // Operations
  {
    slug: "hours_worked",
    name: "Hours Worked",
    category: "operations",
    unit: "hours",
    calcType: "auto",
    icon: Clock,
    color: "amber",
    hero: true,
    source: { table: "time_entries", filter: {}, aggregate: "sum", field: "hours", dateField: "date" },
    perMember: true,
    memberField: "team_member_id",
  },
  {
    slug: "billable_hours",
    name: "Billable Hours",
    category: "operations",
    unit: "hours",
    calcType: "auto",
    icon: Clock,
    color: "orange",
    source: { table: "time_entries", filter: { billable: true }, aggregate: "sum", field: "hours", dateField: "date" },
    perMember: true,
    memberField: "team_member_id",
  },
  {
    slug: "tasks_completed",
    name: "Tasks Completed",
    category: "operations",
    unit: "number",
    calcType: "auto",
    icon: CheckSquare,
    color: "lime",
    source: { table: "tasks", filter: { status: "completed" }, aggregate: "count", dateField: "updated_at" },
    perMember: true,
    memberField: "assigned_to",
  },
  {
    slug: "active_projects",
    name: "Active Projects",
    category: "operations",
    unit: "number",
    calcType: "auto",
    icon: FolderKanban,
    color: "cyan",
    source: { table: "projects", filter: { status: "active" }, aggregate: "count", dateField: null },
    perMember: false,
  },
];

export function getKpiDef(slug) {
  return KPI_DEFINITIONS.find((k) => k.slug === slug);
}

export function getHeroKpis() {
  return KPI_DEFINITIONS.filter((k) => k.hero);
}

export function getKpisByCategory(category) {
  if (category === "all") return KPI_DEFINITIONS;
  return KPI_DEFINITIONS.filter((k) => k.category === category);
}

export function getPerMemberKpis() {
  return KPI_DEFINITIONS.filter((k) => k.perMember);
}

export function formatKpiValue(value, unit) {
  if (value === null || value === undefined) return "--";
  const num = Number(value);
  switch (unit) {
    case "currency":
      return `$${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    case "hours":
      return `${num.toFixed(1)}h`;
    case "percentage":
      return `${num.toFixed(1)}%`;
    default:
      return num.toLocaleString();
  }
}

export function formatMonthLabel(date) {
  return new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function toMonthString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

// Weekly helpers

export function toWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${dd}`;
}

export function formatWeekLabel(dateStr) {
  const start = new Date(dateStr + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${startStr} – ${endStr}`;
}

export function formatWeekShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
