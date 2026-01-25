import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "68e5a112b53f4b50bdce1fda", 
  requiresAuth: true // Ensure authentication is required for all operations
});
