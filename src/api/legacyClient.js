// Legacy compatibility layer for older component patterns
import { supabase } from './supabaseClient';
import * as entities from './supabaseEntities';
import * as integrations from './integrations';

// Compatibility object for components using the old api.entities.X pattern
export const api = {
  entities: {
    Account: entities.Account,
    Client: entities.Client,
    Contact: entities.Contact,
    Project: entities.Project,
    TeamMember: entities.TeamMember,
    Task: entities.Task,
    TimeEntry: entities.TimeEntry,
    Invoice: entities.Invoice,
    Lead: entities.Lead,
    SocialPost: entities.SocialPost,
    Payment: entities.Payment,
    Transaction: entities.Transaction,
    Expense: entities.Expense,
    StripeProduct: entities.StripeProduct,
    StripeSubscription: entities.StripeSubscription,
    BrandingSettings: entities.BrandingSettings,
    Notification: entities.Notification,
    Activity: entities.Activity,
    SOP: entities.SOP,
    UserProfile: entities.UserProfile,
    User: entities.UserProfile,
    // Stubs for removed entities
    BankAccount: {
      list: async () => [],
      filter: async () => [],
      get: async () => null,
      create: async () => null,
      update: async () => null,
      delete: async () => true
    },
    RecurringCharge: {
      list: async () => [],
      filter: async () => [],
      get: async () => null,
      create: async () => null,
      update: async () => null,
      delete: async () => true
    }
  },

  auth: {
    ...entities.User,
    me: entities.User.me
  },

  functions: {
    async invoke(functionName, params = {}) {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: params
      });
      if (error) throw error;
      return { data };
    }
  },

  integrations: {
    Core: integrations.Core
  }
};

export { supabase };
