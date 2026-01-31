import { supabase, getCurrentUser, getCurrentUserProfile } from './supabaseClient';

// Generic entity factory - creates CRUD methods for any table
const createEntity = (tableName) => ({
  // List all records, with optional sorting
  async list(orderBy = '-created_at') {
    const isDesc = orderBy.startsWith('-');
    const column = isDesc ? orderBy.slice(1) : orderBy;

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(column, { ascending: !isDesc });

    if (error) throw error;
    return data;
  },

  // Get a single record by ID
  async get(id) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Filter records
  async filter(filters, orderBy = '-created_at', limit = null) {
    const isDesc = orderBy.startsWith('-');
    const column = isDesc ? orderBy.slice(1) : orderBy;

    let query = supabase
      .from(tableName)
      .select('*');

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    query = query.order(column, { ascending: !isDesc });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Create a new record
  async create(record) {
    const { data, error } = await supabase
      .from(tableName)
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update a record
  async update(id, updates) {
    const { data, error } = await supabase
      .from(tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete a record
  async delete(id) {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Upsert (insert or update)
  async upsert(record, conflictColumn = 'id') {
    const { data, error } = await supabase
      .from(tableName)
      .upsert(record, { onConflict: conflictColumn })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
});

// Create all entities
export const Account = createEntity('accounts');
export const Contact = createEntity('contacts');
export const Project = createEntity('projects');
export const TeamMember = createEntity('team_members');
export const Task = createEntity('tasks');
export const TimeEntry = createEntity('time_entries');
export const Lead = createEntity('leads');
export const Activity = createEntity('activities');
export const Payment = createEntity('payments');
export const Transaction = createEntity('transactions');
export const Expense = createEntity('expenses');
export const Invoice = createEntity('invoices');
export const StripeProduct = createEntity('stripe_products');
export const StripeSubscription = createEntity('stripe_subscriptions');
export const SocialPost = createEntity('social_posts');
export const SOP = createEntity('sops');
export const Notification = createEntity('notifications');
export const BrandingSettings = createEntity('branding_settings');
export const UserProfile = createEntity('user_profiles');

// Client is an alias for Account
export const Client = Account;

// Auth module
export const User = {
  async me() {
    return getCurrentUserProfile();
  },

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data.user;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  },

  async signup(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    if (error) throw error;
    return data.user;
  },

  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return true;
  },

  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
    return true;
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// Export supabase client for direct access when needed
export { supabase };
