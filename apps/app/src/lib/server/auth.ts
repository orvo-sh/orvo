import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import {
  getOAuthProviderState,
  oauthProvider,
} from "@better-auth/oauth-provider";
import { stripe as stripePlugin } from "@better-auth/stripe";
import { emailOTP, jwt, organization } from "better-auth/plugins";
import { and, eq, inArray, sql, type DB } from "@repo/db";
import * as dbSchema from "@repo/db/schema";
import { genId } from "@repo/utils";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import Stripe from "stripe";

import type { Logger } from "@repo/logger";
import type { Email } from "./email";
import { BillingService } from "./services/billing";

const mcpScopes = ["openid", "offline_access", "mcp:read"] as const;

const createAuth = (
  db: DB,
  logger: Logger,
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
      proPriceId: string;
      ingestOveragePriceId: string;
      scoutOveragePriceId: string;
      trialDays: number;
    };
  },
) => {
  logger = logger.child("AuthService");
  return betterAuth({
    baseURL: config.baseUrl,
    trustedOrigins: [config.baseUrl],
    secret: config.secret,
    rateLimit: {
      enabled: env.MODE !== "test",
      customRules: {
        "/email-otp/send-verification-otp": {
          window: 120,
          max: 1,
        },
      },
    },
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
                subscription: "sub",
                oauthClient: "oauthc",
                oauthAccessToken: "oauthat",
                oauthRefreshToken: "oauthrt",
                oauthConsent: "oauthcn",
                oauthClientResource: "oauthcr",
                oauthResource: "oauthr",
              } as Record<string, string>
            )[model] ?? "auth";
          return genId(pre);
        },
      },
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: dbSchema,
      camelCase: true,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          const soleOrganizationRows = await db
            .select({ organizationId: dbSchema.member.organizationId })
            .from(dbSchema.member)
            .groupBy(dbSchema.member.organizationId)
            .having(
              sql`count(*) = 1 and max(${dbSchema.member.userId}) = ${user.id}`,
            );

          if (soleOrganizationRows.length === 0) {
            return;
          }

          await db.delete(dbSchema.organization).where(
            inArray(
              dbSchema.organization.id,
              soleOrganizationRows.map((row) => row.organizationId),
            ),
          );
        },
      },
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
              try {
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
              } catch (error) {
                logger.error(
                  "sendVerificationOTP: failed to send verification otp",
                  error as Error,
                );
              }
            },
          })
        : undefined,
      organization({
        sendInvitationEmail: async ({
          id,
          email: inviteeEmail,
          organization,
          inviter,
        }) => {
          if (!email) return;
          await email.sendEmail({
            to: inviteeEmail,
            subject: `You're invited to ${organization.name} on Orvo`,
            template: "invitation",
            props: {
              inviterName: inviter.user.name,
              organizationName: organization.name,
              invitationUrl: new URL(
                `/invite/${id}`,
                config.baseUrl,
              ).toString(),
            },
          });
        },
        organizationHooks: {
          beforeCreateInvitation: async ({ invitation }) => {
            const appAccessMode =
              invitation.appAccessMode === "selected" ? "selected" : "all";
            let appIds: string[] = [];
            try {
              const parsed = JSON.parse(invitation.appIds ?? "[]");
              if (
                Array.isArray(parsed) &&
                parsed.every((id) => typeof id === "string")
              ) {
                appIds = [...new Set(parsed)];
              }
            } catch {
              throw new APIError("BAD_REQUEST", {
                message: "Invalid app access selection.",
              });
            }

            if (appAccessMode === "selected") {
              const matchingApps = appIds.length
                ? await db
                    .select({ id: dbSchema.app.id })
                    .from(dbSchema.app)
                    .where(
                      and(
                        eq(
                          dbSchema.app.organizationId,
                          invitation.organizationId,
                        ),
                        inArray(dbSchema.app.id, appIds),
                      ),
                    )
                : [];
              if (
                matchingApps.length !== appIds.length ||
                appIds.length === 0
              ) {
                throw new APIError("BAD_REQUEST", {
                  message: "Choose one or more apps from this organization.",
                });
              }
            } else {
              appIds = [];
            }

            return { data: { appAccessMode, appIds: JSON.stringify(appIds) } };
          },
          afterAcceptInvitation: async ({
            invitation,
            member: acceptedMember,
          }) => {
            const mode =
              invitation.appAccessMode === "selected" ? "selected" : "all";
            let appIds: string[] = [];
            try {
              const parsed = JSON.parse(invitation.appIds ?? "[]");
              if (
                Array.isArray(parsed) &&
                parsed.every((id) => typeof id === "string")
              ) {
                appIds = [...new Set(parsed)];
              }
            } catch {
              throw new Error(
                "The invitation contains invalid app access data.",
              );
            }
            await db
              .update(dbSchema.member)
              .set({ appAccessMode: mode })
              .where(eq(dbSchema.member.id, acceptedMember.id));
            if (mode === "selected" && appIds.length > 0) {
              const validApps = await db
                .select({ id: dbSchema.app.id })
                .from(dbSchema.app)
                .where(
                  and(
                    eq(dbSchema.app.organizationId, invitation.organizationId),
                    inArray(dbSchema.app.id, appIds),
                  ),
                );
              await db
                .insert(dbSchema.memberAppAccess)
                .values(
                  validApps.map(({ id }) => ({
                    memberId: acceptedMember.id,
                    appId: id,
                  })),
                )
                .onConflictDoNothing();
            }
          },
        },
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
          member: {
            additionalFields: {
              appAccessMode: {
                type: "string",
                required: false,
                input: false,
                defaultValue: "all",
                fieldName: "app_access_mode",
              },
            },
          },
          invitation: {
            additionalFields: {
              appAccessMode: {
                type: "string",
                required: false,
                input: true,
                defaultValue: "all",
                fieldName: "app_access_mode",
              },
              appIds: {
                type: "string",
                required: false,
                input: true,
                defaultValue: "[]",
                fieldName: "app_ids",
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
                  name: "pro",
                  priceId: config.stripe.proPriceId,
                  lineItems: [
                    { price: config.stripe.ingestOveragePriceId },
                    { price: config.stripe.scoutOveragePriceId },
                  ],
                  freeTrial: { days: config.stripe.trialDays },
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
              getCheckoutSessionParams: async ({ user, subscription }) => ({
                params: {
                  payment_method_collection: "if_required",
                  customer_email: user.email,
                },
                options: {
                  idempotencyKey: `orvo-subscription-checkout-${subscription.id}`,
                },
              }),
              onSubscriptionCreated: async ({ subscription }) =>
                void (await billingService.onSubscriptionCreated(subscription)),
              onSubscriptionComplete: async ({ subscription }) =>
                void (await billingService.onSubscriptionCreated(subscription)),
              onSubscriptionUpdate: async ({ subscription }) =>
                void (await billingService.onSubscriptionCreated(subscription)),
              onSubscriptionDeleted: async ({ subscription }) =>
                await billingService.onSubscriptionDeleted({
                  organizationId: subscription.referenceId,
                }),
            },
            onEvent: async (event) => {
              if (
                event.type !== "customer.subscription.created" &&
                event.type !== "customer.subscription.updated"
              ) {
                return;
              }

              const organizationId = event.data.object.metadata?.referenceId;
              if (!organizationId) return;

              await billingService.reconcileSubscriptions({ organizationId });
            },
            organization: {
              enabled: true,
            },
          })
        : undefined,
      jwt(),
      oauthProvider({
        loginPage: "/sign-in",
        consentPage: "/oauth/authorize",
        validAudiences: [`${config.baseUrl}/api/mcp`],
        resources: [`${config.baseUrl}/api/mcp`],
        enforcePerClientResources: false,
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        silenceWarnings: {
          oauthAuthServerConfig: true,
          openidConfig: true,
        },
        scopes: [...mcpScopes],
        clientRegistrationDefaultScopes: [...mcpScopes],
        clientRegistrationAllowedScopes: [...mcpScopes],
        postLogin: {
          page: "/oauth/authorize",
          shouldRedirect: async () => false,
          consentReferenceId: async ({ user }) => {
            if (!user) return undefined;

            const oauthQuery = (await getOAuthProviderState())?.query;
            const clientId = oauthQuery
              ? new URLSearchParams(oauthQuery).get("client_id")
              : null;
            if (!clientId) return undefined;

            return (
              await db.query.mcpOauthGrant.findFirst({
                where: and(
                  eq(dbSchema.mcpOauthGrant.clientId, clientId),
                  eq(dbSchema.mcpOauthGrant.userId, user.id),
                ),
              })
            )?.organizationId;
          },
        },
        customAccessTokenClaims: async ({ referenceId }) =>
          referenceId ? { organization_id: referenceId } : {},
      }),
      sveltekitCookies(getRequestEvent),
    ].filter((x): x is NonNullable<typeof x> => !!x),
  });
};

type Auth = ReturnType<typeof createAuth>;
export { createAuth, type Auth };
