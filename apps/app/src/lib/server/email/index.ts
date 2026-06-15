import { Resend } from "resend";
import { renderTemplate, type Template } from "./email.generated";

type EmailTransport = "console" | "resend";

type EmailInput = {
  to: string;
  subject: string;
  from?: string;
} & Template;

class Email {
  private resend?: Resend;
  private transport: EmailTransport;
  constructor(config: { transport: EmailTransport; resendApiKey?: string }) {
    if (config.transport === "resend" && !config.resendApiKey)
      throw new Error(
        "Resend API key is required when transport is set to 'resend'.",
      );
    if (config.resendApiKey) {
      this.resend = new Resend(config.resendApiKey);
    }
    this.transport = config.transport;
  }

  async sendEmail(input: EmailInput) {
    const html = renderTemplate(input);

    switch (this.transport) {
      case "resend":
        const response = await this.resend?.emails.send({
          from: "Orvo <no-reply@mail.orvo.sh>",
          to: [input.to],
          subject: input.subject,
          html,
        });

        if (!response) throw new Error("Failed to get response from resend.");
        if (response?.error) throw new Error(response.error.message);
        return response.data.id;

      case "console":
        console.log(`
========================================
TO: ${input.to}
SUBJECT: ${input.subject}
========================================
${html}
========================================
`);

        return "console";
    }
  }
}

export { Email, type EmailInput };
