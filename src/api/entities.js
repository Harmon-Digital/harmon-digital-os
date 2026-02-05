// Supabase entities
export {
  Account,
  Client, // Alias for Account
  Contact,
  Project,
  TeamMember,
  Task,
  TimeEntry,
  Invoice,
  Lead,
  SocialPost,
  Payment,
  Transaction,
  Expense,
  StripeProduct,
  StripeSubscription,
  BrandingSettings,
  Notification,
  Activity,
  SOP,
  User,
  UserProfile,
  KpiEntry,
  supabase
} from './supabaseEntities';

// Legacy exports that don't exist in new schema (stub them out)
export const BankAccount = {
  list: async () => [],
  get: async () => null,
  create: async () => null,
  update: async () => null,
  delete: async () => true,
  filter: async () => []
};

export const RecurringCharge = {
  list: async () => [],
  get: async () => null,
  create: async () => null,
  update: async () => null,
  delete: async () => true,
  filter: async () => []
};