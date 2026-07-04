import { Instrument } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createCreateMcpToken } from "./methods/create-mcp-token";
import { createListMcpTokens } from "./methods/list-mcp-tokens";
import { createRevokeMcpToken } from "./methods/revoke-mcp-token";
import { createValidateMcpToken } from "./methods/validate-mcp-token";
import {
  createMcpTokenInputSchema,
  listMcpTokensInputSchema,
  revokeMcpTokenInputSchema,
} from "./schema";

@Instrument({ prefix: "mcpToken" })
class McpTokenService {
  private logger: Logger;
  private listMcpTokensMethod: ReturnType<typeof createListMcpTokens>;
  private createMcpTokenMethod: ReturnType<typeof createCreateMcpToken>;
  private revokeMcpTokenMethod: ReturnType<typeof createRevokeMcpToken>;
  private validateMcpTokenMethod: ReturnType<typeof createValidateMcpToken>;

  constructor(db: DB, logger: Logger, secret: string) {
    this.logger = logger.child("McpTokenService");
    this.listMcpTokensMethod = createListMcpTokens({
      db,
      logger: this.logger,
    });
    this.createMcpTokenMethod = createCreateMcpToken({
      db,
      logger: this.logger,
      secret,
    });
    this.revokeMcpTokenMethod = createRevokeMcpToken({
      db,
      logger: this.logger,
    });
    this.validateMcpTokenMethod = createValidateMcpToken({
      db,
      logger: this.logger,
      secret,
    });
  }

  async listMcpTokens(
    input: z.input<typeof listMcpTokensInputSchema>,
    context: { organizationId: string },
  ) {
    return this.listMcpTokensMethod(input, context);
  }

  async createMcpToken(
    input: z.input<typeof createMcpTokenInputSchema>,
    context: { organizationId: string; userId: string },
  ) {
    return this.createMcpTokenMethod(input, context);
  }

  async revokeMcpToken(
    input: z.input<typeof revokeMcpTokenInputSchema>,
    context: { organizationId: string },
  ) {
    return this.revokeMcpTokenMethod(input, context);
  }

  async validateMcpToken(input: {
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    return this.validateMcpTokenMethod(input);
  }
}

export * from "./schema";
export { McpTokenService };
