import type { ModuleDefinition } from "./types.ts";

export const storageModule: ModuleDefinition = {
  name: "storage",
  label: "Storage",
  hint: "S3 or MinIO storage client with presigned URL helpers.",
  envVars: [
    { key: "S3_ENDPOINT", value: "http://localhost:9000" },
    { key: "S3_REGION", value: "sa-east-1" },
    { key: "S3_ACCESS_KEY", value: "minioadmin" },
    { key: "S3_SECRET_KEY", value: "minioadmin" },
    { key: "S3_BUCKET", value: "{{projectName}}" },
  ],
  dockerServices: [
    {
      name: "minio",
      image: "minio/minio",
      command: ["server", "/data", "--console-address", ":9001"],
      ports: ["9000:9000", "9001:9001"],
      environment: {
        MINIO_ROOT_PASSWORD: "${S3_SECRET_KEY:-minioadmin}",
        MINIO_ROOT_USER: "${S3_ACCESS_KEY:-minioadmin}",
      },
      volumes: ["minio_data:/data"],
      healthcheck: {
        test: ["CMD-SHELL", "curl -f http://localhost:9000/minio/health/live || exit 1"],
        interval: "10s",
        timeout: "5s",
        retries: 20,
      },
    },
  ],
  backend: {
    dependencies: {
      "@aws-sdk/client-s3": "^3.1009.0",
      "@aws-sdk/s3-request-presigner": "^3.1009.0",
    },
  },
};
