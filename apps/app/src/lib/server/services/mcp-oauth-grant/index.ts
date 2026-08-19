import { Instrument } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createGetConsentPageData } from "./methods/get-consent-page-data";
import { createResolveGrant } from "./methods/resolve-grant";
import { createUpsertGrant } from "./methods/upsert-grant";
import {
  mcpOauthClientInputSchema,
  upsertMcpOauthGrantInputSchema,
} from "./schema";

@Instrument({ prefix: "mcpOauthGrant" })
class McpOauthGrantService {
  private getConsentPageDataMethod: ReturnType<typeof createGetConsentPageData>;
  private resolveGrantMethod: ReturnType<typeof createResolveGrant>;
  private upsertGrantMethod: ReturnType<typeof createUpsertGrant>;

  constructor(db: DB, logger: Logger) {
    const childLogger = logger.child("McpOauthGrantService");
    this.getConsentPageDataMethod = createGetConsentPageData({
      db,
      logger: childLogger,
    });
    this.resolveGrantMethod = createResolveGrant({ db, logger: childLogger });
    this.upsertGrantMethod = createUpsertGrant({ db, logger: childLogger });
  }

  async getConsentPageData(
    input: z.input<typeof mcpOauthClientInputSchema>,
    context: { userId: string },
  ) {
    return this.getConsentPageDataMethod(input, context);
  }

  async resolveGrant(
    input: z.input<typeof mcpOauthClientInputSchema>,
    context: { userId: string },
  ) {
    return this.resolveGrantMethod(input, context);
  }

  async upsertGrant(
    input: z.input<typeof upsertMcpOauthGrantInputSchema>,
    context: { userId: string },
  ) {
    return this.upsertGrantMethod(input, context);
  }
}

export * from "./schema";
export { McpOauthGrantService };
