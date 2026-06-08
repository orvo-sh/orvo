import { createHash, createHmac } from 'node:crypto';

class Storage {
  private accessKeyId: string;
  private bucket: string;
  private endpoint: string;
  private region: string;
  private secretAccessKey: string;

  constructor(config: {
    region: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  }) {
    this.accessKeyId = config.accessKeyId;
    this.bucket = config.bucket;
    this.endpoint = config.endpoint;
    this.region = config.region;
    this.secretAccessKey = config.secretAccessKey;
  }

  async getPresignedUploadUrl(
    key: string,
    options: {
      contentType: string;
      expiresIn?: number;
    }
  ) {
    const expiresIn = options.expiresIn ?? 900;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const signedHeaders = 'host';
    const algorithm = 'AWS4-HMAC-SHA256';
    const endpoint = new URL(this.endpoint);
    const host = endpoint.host;
    const basePath = endpoint.pathname.replace(/\/$/, '');
    const canonicalUri = `${basePath}/${this.bucket}/${encodePath(key)}`;
    const queryEntries = [
      ['X-Amz-Algorithm', algorithm],
      ['X-Amz-Credential', `${this.accessKeyId}/${credentialScope}`],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(expiresIn)],
      ['X-Amz-SignedHeaders', signedHeaders]
    ];
    const canonicalQueryString = queryEntries
      .map(([queryKey, value]) => `${encodeRfc3986(queryKey)}=${encodeRfc3986(value)}`)
      .sort()
      .join('&');
    const canonicalHeaders = `host:${host}\n`;
    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD'
    ].join('\n');
    const stringToSign = [algorithm, amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
    const signingKey = getSigningKey(this.secretAccessKey, dateStamp, this.region, 's3');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return `${endpoint.origin}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  async upload() {
    throw new Error('Storage.upload is not implemented.');
  }

  async getSignedUrl() {
    throw new Error('Storage.getSignedUrl is not implemented.');
  }

  async delete() {
    throw new Error('Storage.delete is not implemented.');
  }
}

const encodePath = (value: string) => value.split('/').map(encodeRfc3986).join('/');

const encodeRfc3986 = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const hmac = (key: Buffer | string, value: string) =>
  createHmac('sha256', key).update(value).digest();

const getSigningKey = (
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string
) => {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, 'aws4_request');
};

export { Storage };
