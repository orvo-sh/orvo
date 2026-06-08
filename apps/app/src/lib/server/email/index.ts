import { templates, type Template } from './email.generated';

type EmailInput = {
	to: string;
	subject: string;
	from?: string;
} & Template;

interface Email {
	sendEmail: (input: EmailInput) => Promise<string>;
}

class ResendEmail implements Email {
	private readonly resendApiKey: string;
	private readonly defaultFrom: string;

	constructor(config: { resendApiKey: string; from: string }) {
		this.resendApiKey = config.resendApiKey;
		this.defaultFrom = config.from;
	}

	sendEmail = async (input: EmailInput): Promise<string> => {
		const html = renderTemplate(input);

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

class ConsoleEmail implements Email {
	sendEmail = async (input: EmailInput): Promise<string> => {
		console.info(`Sending email '${input.template}' to: ${input.to}, subject: ${input.subject}`, input.props);
		return 'email-id';
	};
}

const renderTemplate = (input: EmailInput) => {
	switch (input.template) {
		case 'billing-trial-expired':
			return templates['billing-trial-expired'](input.props);
		case 'billing-trial-started':
			return templates['billing-trial-started'](input.props);
		case 'billing-trial-will-end':
			return templates['billing-trial-will-end'](input.props);
		case 'otp':
			return templates.otp(input.props);
	}
};

export { ConsoleEmail, ResendEmail, type Email };
