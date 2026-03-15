import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../env";

export function resolveStorageEnvironment(rawEnv: Record<string, string | undefined> = env) {
  if (!rawEnv.S3_BUCKET) {
    throw new Error("S3_BUCKET is required");
  }

  return {
    accessKeyId: rawEnv.S3_ACCESS_KEY,
    bucket: rawEnv.S3_BUCKET,
    endpoint: rawEnv.S3_ENDPOINT,
    region: rawEnv.S3_REGION ?? "sa-east-1",
    secretAccessKey: rawEnv.S3_SECRET_KEY,
  };
}

export function createStorageClient(rawEnv: Record<string, string | undefined> = env) {
  const configuration = resolveStorageEnvironment(rawEnv);

  return new S3Client({
    credentials:
      configuration.accessKeyId && configuration.secretAccessKey
        ? {
            accessKeyId: configuration.accessKeyId,
            secretAccessKey: configuration.secretAccessKey,
          }
        : undefined,
    endpoint: configuration.endpoint,
    forcePathStyle: Boolean(configuration.endpoint),
    region: configuration.region,
  });
}

export async function createPresignedUploadUrl(input: {
  contentType: string;
  key: string;
  rawEnv?: Record<string, string | undefined>;
}) {
  const configuration = resolveStorageEnvironment(input.rawEnv);
  const client = createStorageClient(input.rawEnv);
  const command = new PutObjectCommand({
    Bucket: configuration.bucket,
    ContentType: input.contentType,
    Key: input.key,
  });

  return getSignedUrl(client, command, { expiresIn: 15 * 60 });
}

export async function createPresignedDownloadUrl(input: {
  key: string;
  rawEnv?: Record<string, string | undefined>;
}) {
  const configuration = resolveStorageEnvironment(input.rawEnv);
  const client = createStorageClient(input.rawEnv);
  const command = new GetObjectCommand({
    Bucket: configuration.bucket,
    Key: input.key,
  });

  return getSignedUrl(client, command, { expiresIn: 60 * 60 });
}
