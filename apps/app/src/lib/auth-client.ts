import { createAuthClient } from "better-auth/svelte";
import { stripeClient } from "@better-auth/stripe/client";
import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { getFriendlyAuthErrorMessage } from "./auth-errors";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    emailOTPClient(),
    stripeClient({ subscription: true }),
  ],
});

const getFriendlyErrorMessage = (code: string): string | undefined =>
  getFriendlyAuthErrorMessage(code);

export { getFriendlyErrorMessage };
