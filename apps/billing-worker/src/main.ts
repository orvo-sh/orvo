import { getDb, type DB } from '@repo/db';
import {
	member,
	organization,
	organizationBillingNotification,
	organizationBillingProfile,
	user
} from '@repo/db/schema';
import { Logger } from '@repo/logger';
import { and, asc, eq, lte } from 'drizzle-orm';

const sleepIntervalMs = 15_000;
const maxNotificationsPerCycle = 50;
const retryBackoffMinutes = [1, 5, 15, 60];

class BillingWorker {
	private logger: Logger;

	constructor(
		private db: DB,
		private mailer: Mailer,
		logger: Logger
	) {
		this.logger = logger.child('BillingWorker');
	}

	run = async () => {
		for (;;) {
			try {
				await this.processDueNotifications();
			} catch (error) {
				this.logger.error('run: cycle failed', error as Error);
			}

			await sleep(sleepIntervalMs);
		}
	};

	private processDueNotifications = async () => {
		const now = new Date();
		const notifications = await this.db.query.organizationBillingNotification.findMany({
			where: and(
				eq(organizationBillingNotification.status, 'pending'),
				lte(organizationBillingNotification.nextAttemptAt, now)
			),
			orderBy: [asc(organizationBillingNotification.nextAttemptAt)],
			limit: maxNotificationsPerCycle
		});

		for (const notification of notifications) {
			await this.deliverNotification(notification);
		}
	};

	private deliverNotification = async (
		notification: typeof organizationBillingNotification.$inferSelect
	) => {
		try {
			const currentOrganization = await this.db.query.organization.findFirst({
				where: eq(organization.id, notification.organizationId)
			});
			if (!currentOrganization) {
				await this.markSent(notification.id);
				return;
			}

			const [profile, owners] = await Promise.all([
				this.db.query.organizationBillingProfile.findFirst({
					where: eq(organizationBillingProfile.organizationId, notification.organizationId)
				}),
				this.db
					.select({
						email: user.email
					})
					.from(member)
					.innerJoin(user, eq(member.userId, user.id))
					.where(and(eq(member.organizationId, notification.organizationId), eq(member.role, 'owner')))
			]);

			const recipients = new Set<string>();
			if (profile?.billingEmail) {
				recipients.add(profile.billingEmail);
			}
			for (const owner of owners) {
				recipients.add(owner.email);
			}

			if (recipients.size === 0) {
				await this.markSent(notification.id);
				return;
			}

			const payload = safeParsePayload(notification.payload);
			const email = buildEmail(notification.kind, payload, currentOrganization.name);

			for (const recipient of recipients) {
				await this.mailer.send({
					to: recipient,
					subject: email.subject,
					html: email.html
				});
			}

			await this.markSent(notification.id);
		} catch (error) {
			this.logger.error('deliverNotification: failed to deliver notification', {
				error,
				notificationId: notification.id
			});
			await this.scheduleRetry(notification);
		}
	};

	private markSent = async (notificationId: string) => {
		await this.db
			.update(organizationBillingNotification)
			.set({
				status: 'sent',
				sentAt: new Date(),
				updatedAt: new Date(),
				lastError: null
			})
			.where(eq(organizationBillingNotification.id, notificationId));
	};

	private scheduleRetry = async (
		notification: typeof organizationBillingNotification.$inferSelect
	) => {
		const nextAttemptCount = notification.attemptCount + 1;
		const retryMinutes =
			retryBackoffMinutes[Math.min(nextAttemptCount - 1, retryBackoffMinutes.length - 1)] ?? 60;
		const nextAttemptAt = new Date(Date.now() + retryMinutes * 60_000);
		const status = nextAttemptCount >= retryBackoffMinutes.length + 1 ? 'failed' : 'pending';

		await this.db
			.update(organizationBillingNotification)
			.set({
				status,
				attemptCount: nextAttemptCount,
				nextAttemptAt,
				updatedAt: new Date(),
				lastError: 'Delivery failed'
			})
			.where(eq(organizationBillingNotification.id, notification.id));
	};
}

type MailInput = {
	to: string;
	subject: string;
	html: string;
};

interface Mailer {
	send: (input: MailInput) => Promise<void>;
}

class ConsoleMailer implements Mailer {
	send = async (input: MailInput) => {
		console.info(`Sending billing email to ${input.to}: ${input.subject}`);
	};
}

class ResendMailer implements Mailer {
	constructor(
		private apiKey: string,
		private from: string
	) {}

	send = async (input: MailInput) => {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				to: [input.to],
				from: this.from,
				subject: input.subject,
				html: input.html
			})
		});

		if (!response.ok) {
			throw new Error(`Failed to send email: ${await response.text()}`);
		}
	};
}

const safeParsePayload = (payload: string): Record<string, string | number | boolean | null> => {
	try {
		return JSON.parse(payload) as Record<string, string | number | boolean | null>;
	} catch {
		return {};
	}
};

const buildEmail = (
	kind: string,
	payload: Record<string, string | number | boolean | null>,
	organizationName: string
) => {
	switch (kind) {
		case 'usage_threshold': {
			const signal = String(payload.signal ?? 'telemetry');
			const threshold = Number(payload.threshold ?? 0);
			return {
				subject: `${organizationName} is at ${threshold}% of ${signal} usage`,
				html: `<p>${organizationName} has reached ${threshold}% of its monthly ${signal} allowance.</p>
<p>Used: ${formatGb(payload.usedBytes)} GB of ${formatGb(payload.includedBytes)} GB.</p>`
			};
		}
		case 'trial_started':
			return {
				subject: `${organizationName} trial started`,
				html: `<p>Your Orvo trial for ${organizationName} is now active.</p>
<p>Trial end: ${formatDate(payload.trialEnd)}.</p>`
			};
		case 'trial_will_end':
			return {
				subject: `${organizationName} trial ends soon`,
				html: `<p>Your Orvo trial for ${organizationName} is ending soon.</p>
<p>Trial end: ${formatDate(payload.trialEnd)}.</p>`
			};
		case 'trial_expired':
			return {
				subject: `${organizationName} trial ended`,
				html: `<p>Your Orvo trial for ${organizationName} has ended.</p>
<p>Add a payment method from billing to restore access.</p>`
			};
		default:
			return {
				subject: `${organizationName} billing notification`,
				html: `<p>You have a new billing notification for ${organizationName}.</p>`
			};
	}
};

const formatGb = (value: string | number | boolean | null | undefined) => {
	if (typeof value !== 'number') {
		return '0.0';
	}

	return (value / 1_000_000_000).toFixed(1);
};

const formatDate = (value: string | number | boolean | null | undefined) => {
	if (typeof value !== 'string' || value.length === 0) {
		return 'Unknown';
	}

	return new Date(value).toLocaleDateString();
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
	const postgresUrl = process.env.POSTGRES_URL;
	if (!postgresUrl) {
		throw new Error('Missing POSTGRES_URL');
	}

	const resendApiKey = process.env.RESEND_API_KEY;
	const resendFromEmail = process.env.RESEND_FROM_EMAIL ?? 'Orvo <onboarding@resend.dev>';
	const logger = new Logger('billing-worker', { pretty: true });
	const db = getDb(postgresUrl);
	const mailer: Mailer = resendApiKey
		? new ResendMailer(resendApiKey, resendFromEmail)
		: new ConsoleMailer();

	const worker = new BillingWorker(db, mailer, logger);
	logger.info('main: starting billing worker');
	await worker.run();
};

await main();
