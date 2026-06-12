import { Resend } from 'resend';
import { renderTemplate, type Template } from "./email.generated";

type EmailInput = {
  to: string;
  subject: string;
  from?: string;
} & Template;

class Email {
  private resend?: Resend;
  constructor(
    config: { resendApiKey: string }
  ) {
    this.resend = new Resend(config.resendApiKey)
  }

  async sendEmail(input: EmailInput) {
    const html = renderTemplate(input);
    const response = await this.resend?.emails.send({
      from: "Orvo <no-reply@mail.orvo.sh>",
      to: [input.to],
      subject: input.subject,
      html,
    })

    if (!response) throw new Error("Failed to get response from resend.")
    if (response?.error) throw new Error(response.error.message)
    return response.data.id
  }
}

export { Email, type EmailInput };

