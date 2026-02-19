// Supabase Edge Functions
import { supabase } from './supabaseClient';
import { Project, TeamMember, Notification } from './supabaseEntities';

// Helper to invoke Edge Functions
const invokeFunction = async (functionName, params = {}) => {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: params
  });
  if (error) throw error;
  return { data };
};

// Stripe functions - require Edge Function deployment
export const createStripeInvoice = (params) => invokeFunction('create-stripe-invoice', params);
export const stripeWebhook = (params) => invokeFunction('stripe-webhook', params);
export const syncStripeData = (params) => invokeFunction('sync-stripe-data', params);
export const createStripeCustomer = (params) => invokeFunction('create-stripe-customer', params);
export const listStripeCustomers = (params) => invokeFunction('list-stripe-customers', params);
export const listStripeSubscriptions = (params) => invokeFunction('list-stripe-subscriptions', params);

// These can be direct database operations
export const linkStripeCustomer = async ({ contactId, stripeCustomerId }) => {
  const { data, error } = await supabase
    .from('contacts')
    .update({ stripe_customer_id: stripeCustomerId })
    .eq('id', contactId)
    .select()
    .single();

  if (error) throw error;
  return { data: { success: true } };
};

// Email functions - require Edge Function deployment
export const sendNotificationEmail = (params) => invokeFunction('send-notification-email', params);
export const testEmail = (params) => invokeFunction('test-email', params);

// Notification functions - direct database operations
export const sendNotification = async ({
  userId,
  type = 'info',
  title,
  message,
  link,
  category = 'general',
  priority = 'normal',
  emailEnabled = true,
  source = null,
  metadata = null,
}) => {
  return Notification.create({
    user_id: userId,
    type,
    title,
    message,
    link,
    category,
    priority,
    email_enabled: emailEnabled,
    source,
    metadata,
    read: false,
  });
};

export const checkNotificationTriggers = (params) => invokeFunction('check-notification-triggers', params);

// Ticket function - requires Edge Function if external
export const createTicket = (params) => invokeFunction('create-ticket', params);

// These can be direct database queries
export const getProjects = async () => {
  return Project.list('-created_at');
};

export const getTeamMembers = async () => {
  return TeamMember.filter({ status: 'active' });
};

