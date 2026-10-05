import { createAuthClient } from "better-auth/svelte";
import { stripeClient } from "@better-auth/stripe/client";
import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { getFriendlyAuthErrorMessage } from "./auth-errors";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      schema: {
        invitation: {
          additionalFields: {
            appAccessMode: { type: "string", required: false, input: true },
            appIds: { type: "string", required: false, input: true },
          },
        },
      },
    }),
    emailOTPClient(),
    stripeClient({ subscription: true }),
  ],
});

const getFriendlyErrorMessage = (code: string): string | undefined =>
  getFriendlyAuthErrorMessage(code);

export { getFriendlyErrorMessage };
