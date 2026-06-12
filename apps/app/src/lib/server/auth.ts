import { getRequestEvent } from "$app/server";
import { stripe as stripePlugin } from "@better-auth/stripe";
import { type DB } from "@repo/db";
import * as dbSchema from "@repo/db/schema";
import { genId } from "@repo/utils";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, organization } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { and, eq } from "drizzle-orm";
import Stripe from "stripe";

import type { Email } from "./email";
import { BillingService } from "./services/billing.service";

const createAuth = (
  db: DB,
  email: Nullable<Email>,
  billingService: Nullable<BillingService>,
  config: {
    secret: string;
    baseUrl: string;
    github?: {
      clientId: string;
      clientSecret: string;
    };
    stripe?: {
      client: Stripe;
      webhookSecret: string;
      starterPriceId: string;
      proPriceId: string;
    };
  },
) => {
  return betterAuth({
    baseURL: config.baseUrl,
    secret: config.secret,
    advanced: {
      database: {
        generateId: ({ model }) => {
          const pre =
            (
              {
                account: "acct",
                session: "sess",
                user: "usr",
                verification: "vrfy",
                organization: "org",
                member: "memb",
                invitation: "inv",
                "rate-limit": "rlmt",
              } as any
            )[model] ?? "auth";
          return genId(pre);
        },
      },
    },
    database: drizzleAdapter(db, { provider: "pg", schema: dbSchema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    emailVerification:
      email != null
        ? {
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
        }
        : undefined,
    socialProviders: config.github
      ? {
        github: {
          clientId: config.github.clientId,
          clientSecret: config.github.clientSecret,
        },
      }
      : undefined,
    plugins: [
      email !== null
        ? emailOTP({
          overrideDefaultEmailVerification: true,
          sendVerificationOTP: async ({ email: emailAddr, otp, type }) => {
            switch (type) {
              case "email-verification":
                email?.sendEmail({
                  to: emailAddr,
                  subject: "Verify your email",
                  template: "otp",
                  props: {
                    code: otp,
                    purpose: "sign-up",
                  },
                });
                break;
            }
          },
        })
        : undefined,
      organization({
        schema: {
          organization: {
            additionalFields: {
              billingPlan: {
                type: "string",
                required: false,
                input: false,
                fieldName: "billing_plan",
              },
              billingStatus: {
                type: "string",
                required: false,
                input: false,
                fieldName: "billing_status",
              },
            },
          },
        },
      }),
      config.stripe && billingService
        ? stripePlugin({
          stripeClient: config.stripe.client,
          stripeWebhookSecret: config.stripe.webhookSecret,
          createCustomerOnSignUp: false,
          subscription: {
            enabled: true,
            plans: [
              {
                name: "starter",
                priceId: config.stripe.starterPriceId,
                freeTrial: {
                  days: 14,
                  onTrialExpired: async (subscription: {
                    referenceId: string;
                  }) =>
                    await billingService.onTrialExpired({
                      organizationId: subscription.referenceId,
                    }),
                },
              },
              {
                name: "pro",
                priceId: config.stripe.proPriceId,
                freeTrial: {
                  days: 14,
                  onTrialExpired: async (subscription: {
                    referenceId: string;
                  }) =>
                    await billingService.onTrialExpired({
                      organizationId: subscription.referenceId,
                    }),
                },
              },
            ],
            authorizeReference: async ({ user, referenceId }) => {
              if (!referenceId) return false;

              const currentMember = await db.query.member.findFirst({
                where: and(
                  eq(dbSchema.member.organizationId, referenceId),
                  eq(dbSchema.member.userId, user.id),
                ),
              });

              return currentMember?.role === "owner";
            },
            getCheckoutSessionParams: async () => ({
              params: {
                payment_method_collection: "always",
              },
            }),
            onSubscriptionComplete: async ({ subscription }) =>
              await billingService.onSubscriptionCompleted({
                organizationId: subscription.referenceId,
              }),
            onSubscriptionUpdate: async ({ subscription }) =>
              await billingService.onSubscriptonChanged({
                organizationId: subscription.referenceId,
              }),
            onSubscriptionDeleted: async ({ subscription }) =>
              await billingService.onSubscriptionDeleted({
                organizationId: subscription.referenceId,
              }),
          },
          organization: {
            enabled: true,
          },
        })
        : undefined,
      ,
      sveltekitCookies(getRequestEvent),
    ].filter((x): x is NonNullable<typeof x> => !!x),
  });
};

type Auth = ReturnType<typeof createAuth>;
export { createAuth, type Auth };
