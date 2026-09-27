import type { SlackIntegrationService } from "$lib/server/services/slack-integration";
import type { Logger } from "@repo/logger";

import { BaseWorker } from "./base-worker";

type SlackScoutJob =
  | { kind: "message"; eventId: string }
  | {
      kind: "approval";
      teamId: string;
      slackUserId: string;
      approved: boolean;
      action: {
        chatId: string;
        messageId: string;
        toolCallId: string;
        approvalId: string;
        signature?: string;
        appId: string;
        channelId: string;
        threadTs: string;
      };
    };

class SlackScoutWorker extends BaseWorker {
  name = "slack-scout";
  cron = null;

  constructor(
    logger: Logger,
    private slackIntegrationService: SlackIntegrationService,
  ) {
    super(logger, "SlackScoutWorker");
  }

  protected async run(job: { id: string; data: unknown }) {
    const data = job.data as SlackScoutJob;
    if (!data || (data.kind !== "message" && data.kind !== "approval")) {
      throw new Error("Invalid Slack Scout job.");
    }
    await this.slackIntegrationService.processScoutRun(data);
  }
}

export { SlackScoutWorker, type SlackScoutJob };
