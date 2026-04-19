import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better-Auth client. Talks to `/api/auth/*` (same origin),
 * so no baseURL is required. Used by the login form for email+password.
 */
export const authClient = createAuthClient();
