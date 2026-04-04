import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID!;
const accessKey = process.env.R2_ACCESS_KEY_ID!;
const secretKey = process.env.R2_SECRET_ACCESS_KEY!;

export const R2_BUCKET   = process.env.R2_BUCKET_NAME!;
export const R2_BASE_URL = process.env.R2_PUBLIC_URL!; // no trailing slash

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     accessKey,
    secretAccessKey: secretKey,
  },
});

/** Upload a Buffer to R2 and return the public URL */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         key,
    Body:        body,
    ContentType: contentType,
  }));
  return `${R2_BASE_URL}/${key}`;
}

/** Delete an object from R2 by its storage key */
export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key:    key,
  }));
}

/** Extract the R2 storage key from a full public URL */
export function keyFromUrl(url: string): string {
  return url.replace(`${R2_BASE_URL}/`, '');
}

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
