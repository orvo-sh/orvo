import {
  MinioContainer,
  type StartedMinioContainer,
} from "@testcontainers/minio";

const TEST_BUCKET = "orvo-test";

const startMinioContainer = (image = "minio/minio:latest") =>
  new MinioContainer(image)
    .withUsername("minioadmin")
    .withPassword("minioadmin")
    .start();

const ensureTestBucket = async (container: StartedMinioContainer) => {
  const endpoint = container.getConnectionUrl();
  const { S3Client, CreateBucketCommand } = await import("@aws-sdk/client-s3");
  const s3Client = new S3Client({
    region: "us-east-1",
    endpoint,
    credentials: {
      accessKeyId: container.getUsername(),
      secretAccessKey: container.getPassword(),
    },
    forcePathStyle: true,
  });
  await s3Client.send(new CreateBucketCommand({ Bucket: TEST_BUCKET }));
};

const stopMinioContainer = async (container: StartedMinioContainer) => {
  await container.stop();
};

export {
  ensureTestBucket,
  startMinioContainer,
  stopMinioContainer,
  TEST_BUCKET,
};
