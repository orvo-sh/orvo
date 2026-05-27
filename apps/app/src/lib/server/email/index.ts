import { templates, type Template } from './email.generated';

type EmailInput = {
	to: string;
	subject: string;
	from?: string;
} & Template;

interface IEmail {
	sendEmail: (input: EmailInput) => Promise<string>;
}

class ResendEmail implements IEmail {
	private readonly resendApiKey: string;
	private readonly defaultFrom: string;

	constructor(config: { resendApiKey: string; from: string }) {
		this.resendApiKey = config.resendApiKey;
		this.defaultFrom = config.from;
	}

	sendEmail = async (input: EmailInput): Promise<string> => {
		const html = templates[input.template](input.props);

		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.resendApiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				to: [input.to],
				from: input.from ?? this.defaultFrom,
				subject: input.subject,
				html
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to send email: ${errorText}`);
		}

		const data = (await response.json()) as { id?: string };
		return data.id ?? 'email-id';
	};
}

class ConsoleEmail implements IEmail {
	sendEmail = async (input: EmailInput): Promise<string> => {
		console.info(`Sending email '${input.template}' to: ${input.to}, subject: ${input.subject}`, input.props);
		return 'email-id';
	};
}

export { ConsoleEmail, ResendEmail, type IEmail };
