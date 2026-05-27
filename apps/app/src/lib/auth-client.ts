import { createAuthClient } from 'better-auth/svelte';
import { emailOTPClient, organizationClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [organizationClient(), emailOTPClient()]
});

export const getFriendlyErrorMessage = (code: string): string | undefined => {
  const codeMap: Record<string, string> = {
    USER_NOT_FOUND: 'No account found with that email.',
    USER_ALREADY_EXISTS: 'That email is already taken. Try signing in instead.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'That email is already taken. Try using another email.',
    INVALID_EMAIL_OR_PASSWORD: 'Incorrect credentials. Please try again.',
    FAILED_TO_CREATE_USER: 'Something went wrong creating your account.',
    FAILED_TO_CREATE_SESSION: 'Unable to sign you in right now.',
    SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
    EMAIL_NOT_VERIFIED: 'Please verify your email address first.',
    PASSWORD_TOO_SHORT: 'Password is too short.',
    PASSWORD_TOO_LONG: 'Password is too long.',
    ACCOUNT_NOT_FOUND: 'Account not found.'
  };

  return codeMap[code];
};
