import { Instrument } from "$lib/instrumentation";
import type { DB, Tx } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createCreateIngestionKey } from "./methods/create-ingestion-key";
import { createGetIngestionKey } from "./methods/get-ingestion-key";
import { createRotateIngestionKey } from "./methods/rotate-ingestion-key";
import {
  createIngestionKeyInputSchema,
  getIngestionKeyInputSchema,
  rotateIngestionKeyInputSchema,
} from "./schema";

@Instrument({ prefix: "ingestionKey" })
class IngestionKeyService {
  private logger: Logger;
  private getIngestionKeyMethod: ReturnType<typeof createGetIngestionKey>;
  private createIngestionKeyMethod: ReturnType<typeof createCreateIngestionKey>;
  private rotateIngestionKeyMethod: ReturnType<typeof createRotateIngestionKey>;

  constructor(
    private db: DB,
    logger: Logger,
  ) {
    this.logger = logger.child("IngestionKeyService");
    this.getIngestionKeyMethod = createGetIngestionKey({
      db: this.db,
      logger: this.logger,
    });
    this.createIngestionKeyMethod = createCreateIngestionKey({
      db: this.db,
      logger: this.logger,
    });
    this.rotateIngestionKeyMethod = createRotateIngestionKey({
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

  async createIngestionKey(
    input: z.input<typeof createIngestionKeyInputSchema>,
    context: { appId: string; userId: string },
    tx?: Tx,
  ) {
    return this.createIngestionKeyMethod(input, context, tx);
  }

  async rotateIngestionKey(
    input: z.input<typeof rotateIngestionKeyInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.rotateIngestionKeyMethod(input, context);
  }
}

export * from "./schema";
export { IngestionKeyService };
