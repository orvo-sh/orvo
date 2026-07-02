import { Instrument } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createCreateIngestionKey } from "./methods/create-ingestion-key";
import { createGetIngestionKey } from "./methods/get-ingestion-key";
import { createListIngestionKeys } from "./methods/list-ingestion-keys";
import { createRevokeIngestionKey } from "./methods/revoke-ingestion-key";
import {
  createIngestionKeyInputSchema,
  getIngestionKeyInputSchema,
  listIngestionKeysInputSchema,
  revokeIngestionKeyInputSchema,
} from "./schema";

@Instrument({ prefix: "ingestionKey" })
class IngestionKeyService {
  private logger: Logger;
  private getIngestionKeyMethod: ReturnType<typeof createGetIngestionKey>;
  private listIngestionKeysMethod: ReturnType<typeof createListIngestionKeys>;
  private createIngestionKeyMethod: ReturnType<typeof createCreateIngestionKey>;
  private revokeIngestionKeyMethod: ReturnType<typeof createRevokeIngestionKey>;

  constructor(
    private db: DB,
    logger: Logger,
  ) {
    this.logger = logger.child("IngestionKeyService");
    this.getIngestionKeyMethod = createGetIngestionKey({
      db: this.db,
      logger: this.logger,
    });
    this.listIngestionKeysMethod = createListIngestionKeys({
      db: this.db,
      logger: this.logger,
    });
    this.createIngestionKeyMethod = createCreateIngestionKey({
      db: this.db,
      logger: this.logger,
    });
    this.revokeIngestionKeyMethod = createRevokeIngestionKey({
      db: this.db,
      logger: this.logger,
    });
  }

  async getIngestionKey(
    input: z.input<typeof getIngestionKeyInputSchema>,
    context: { appId: string },
  ) {
    return this.getIngestionKeyMethod(input, context);
  }

  async listIngestionKeys(
    input: z.input<typeof listIngestionKeysInputSchema>,
    context: { appId: string },
  ) {
    return this.listIngestionKeysMethod(input, context);
  }

  async createIngestionKey(
    input: z.input<typeof createIngestionKeyInputSchema>,
    context: { appId: string; userId: string },
    tx?: Tx,
  ) {
    return this.createIngestionKeyMethod(input, context, tx);
  }

  async revokeIngestionKey(
    input: z.input<typeof revokeIngestionKeyInputSchema>,
    context: { appId: string },
  ) {
    return this.revokeIngestionKeyMethod(input, context);
  }
}

export * from "./schema";
export { IngestionKeyService };
