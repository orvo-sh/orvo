const AUTH_ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: "No account found with that email.",
  USER_ALREADY_EXISTS: "That email is already taken. Try signing in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "That email is already taken. Try using another email.",
  INVALID_EMAIL_OR_PASSWORD: "Incorrect credentials. Please try again.",
  FAILED_TO_CREATE_USER: "Something went wrong creating your account.",
  FAILED_TO_CREATE_SESSION: "Unable to sign you in right now.",
  SESSION_EXPIRED: "Your session has expired. Please sign in again.",
  EMAIL_NOT_VERIFIED: "Please verify your email address first.",
  PASSWORD_TOO_SHORT: "Password is too short.",
  PASSWORD_TOO_LONG: "Password is too long.",
  ACCOUNT_NOT_FOUND: "Account not found.",
  ACCOUNT_NOT_LINKED:
    "This account is linked to a different sign-in method. Try the other sign-in options and use the one you originally signed up with.",
  INVALID_CODE: "Unable to continue with GitHub right now. Please try again.",
  OAUTH_PROVIDER_NOT_FOUND: "GitHub sign-in is not available right now.",
  UNABLE_TO_GET_USER_INFO:
    "Unable to load your GitHub account details right now.",
  EMAIL_NOT_FOUND: "Your GitHub account does not expose an email address.",
  UNABLE_TO_LINK_ACCOUNT: "Unable to link your GitHub account right now.",
  "EMAIL_DOESN'T_MATCH": "That GitHub account uses a different email address.",
  ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER:
    "That GitHub account is already linked to another user.",
};

const getFriendlyAuthErrorMessage = (code: string): string | undefined =>
  AUTH_ERROR_MESSAGES[code.toUpperCase()];

export { AUTH_ERROR_MESSAGES, getFriendlyAuthErrorMessage };
