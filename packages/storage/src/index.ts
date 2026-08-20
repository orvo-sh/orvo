import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';

class Storage {
  private client: S3Client;
  private bucket: string;

  constructor(config: {
    region: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    maxUploadSizeBytes?: number;
  }) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
    this.bucket = config.bucket;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    return await awsGetSignedUrl(this.client, command, { expiresIn });
  }

  async getPresignedUploadUrl(
    key: string,
    options: {
      contentType: string;
      expiresIn?: number;
    }
  ) {
    const url = await awsGetSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: options?.contentType
      }),
      {
        expiresIn: options?.expiresIn || 900
      }
    );
    return url;
  }

  async upload(key: string, body: Uint8Array, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType
      })
    );
  }

  async delete(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    });
    await this.client.send(command);
  }
}

export { Storage };
