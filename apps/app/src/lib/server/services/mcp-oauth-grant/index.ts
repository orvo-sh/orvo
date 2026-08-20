import { Instrument } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createGetConsentPageData } from "./methods/get-consent-page-data";
import { createListConnections } from "./methods/list-connections";
import { createRevokeConnection } from "./methods/revoke-connection";
import { createResolveGrant } from "./methods/resolve-grant";
import { createUpsertGrant } from "./methods/upsert-grant";
import {
  listMcpConnectionsInputSchema,
  mcpOauthClientInputSchema,
  revokeMcpConnectionInputSchema,
  upsertMcpOauthGrantInputSchema,
} from "./schema";

@Instrument({ prefix: "mcpOauthGrant" })
class McpOauthGrantService {
  private getConsentPageDataMethod: ReturnType<typeof createGetConsentPageData>;
  private listConnectionsMethod: ReturnType<typeof createListConnections>;
  private revokeConnectionMethod: ReturnType<typeof createRevokeConnection>;
  private resolveGrantMethod: ReturnType<typeof createResolveGrant>;
  private upsertGrantMethod: ReturnType<typeof createUpsertGrant>;

  constructor(db: DB, logger: Logger) {
    const childLogger = logger.child("McpOauthGrantService");
    this.getConsentPageDataMethod = createGetConsentPageData({
      db,
      logger: childLogger,
    });
    this.listConnectionsMethod = createListConnections({
      db,
      logger: childLogger,
    });
    this.revokeConnectionMethod = createRevokeConnection({
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

  async listConnections(
    input: z.input<typeof listMcpConnectionsInputSchema>,
    context: { userId: string; organizationId: string },
  ) {
    return this.listConnectionsMethod(input, context);
  }

  async revokeConnection(
    input: z.input<typeof revokeMcpConnectionInputSchema>,
    context: { userId: string; organizationId: string },
  ) {
    return this.revokeConnectionMethod(input, context);
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
