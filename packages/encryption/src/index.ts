import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

class Encryption {
	private key: Buffer;

	constructor(config: { secret: string }) {
		this.key = createHash('sha256').update(config.secret.trim()).digest();
	}

	encrypt = (value: string) => {
		const iv = randomBytes(12);
		const cipher = createCipheriv('aes-256-gcm', this.key, iv);
		const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
		const tag = cipher.getAuthTag();

		return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
	};

	decrypt = (value: string) => {
		const [ivPart, tagPart, encryptedPart] = value.split('.');

		if (!ivPart || !tagPart || !encryptedPart) {
			throw new Error('Invalid encrypted value');
		}

		const decipher = createDecipheriv(
			'aes-256-gcm',
			this.key,
			Buffer.from(ivPart, 'base64url')
		);
		decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

		return Buffer.concat([
			decipher.update(Buffer.from(encryptedPart, 'base64url')),
			decipher.final()
		]).toString('utf8');
	};
}

export { Encryption };
