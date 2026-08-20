import { Instrument } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { err } from "@repo/utils";

import { createGetUsage } from "./methods/get-usage";
import { createRecordUsage } from "./methods/record-usage";

@Instrument({ prefix: "chatUsage" })
class ChatUsageService {
  private getUsageMethod: ReturnType<typeof createGetUsage>;
  private recordUsageMethod: ReturnType<typeof createRecordUsage>;

  constructor(db: DB, logger: Logger) {
    const childLogger = logger.child("ChatUsageService");
    this.getUsageMethod = createGetUsage({ db, logger: childLogger });
    this.recordUsageMethod = createRecordUsage({ db, logger: childLogger });
  }

  async getUsage(context: { organizationId: string }) {
    return this.getUsageMethod(context);
  }

  async canStart(context: { organizationId: string }) {
    const usage = await this.getUsageMethod(context);
    if (!usage.success) return usage;
    return usage.data.remainingCredits > 0
      ? usage
      : err(
          "This organization has used its Scout credits for the current billing period.",
        );
  }

  async recordUsage(
    input: Parameters<ReturnType<typeof createRecordUsage>>[0],
    context: Parameters<ReturnType<typeof createRecordUsage>>[1],
  ) {
    return this.recordUsageMethod(input, context);
  }
}

export { ChatUsageService };
export { calculateChatCredits } from "./methods/shared";
