import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { createStorageClient, resolveStorageEnvironment } from "./client";

export async function initializeStorageBucket(rawEnv?: Record<string, string | undefined>) {
  const configuration = resolveStorageEnvironment(rawEnv);
  const client = createStorageClient(rawEnv);

  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: configuration.bucket,
      })
    );
    return {
      bucket: configuration.bucket,
      created: false,
    };
  } catch {
    await client.send(
      new CreateBucketCommand({
        Bucket: configuration.bucket,
      })
    );

    return {
      bucket: configuration.bucket,
      created: true,
    };
  }
}
