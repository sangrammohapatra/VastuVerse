/**
 * AWS S3 storage provider.
 *
 * Credentials come from explicit parameters (set by StorageFactory from DB
 * settings) with standard AWS env vars as fallback.
 *
 * Requires @aws-sdk/client-s3 (installed as a project dependency).
 * A new S3Client is created per call so credential changes take effect
 * immediately after an admin updates the settings.
 */

let S3Client, PutObjectCommand, HeadBucketCommand;
try {
  ({ S3Client, PutObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3'));
} catch {
  throw new Error(
    '@aws-sdk/client-s3 is not installed. Run: npm install @aws-sdk/client-s3'
  );
}

/**
 * @param {Buffer} buffer
 * @param {{
 *   key: string,
 *   contentType?: string,
 *   s3Bucket?: string,
 *   s3Region?: string,
 *   s3AccessKeyId?: string,
 *   s3SecretAccessKey?: string,
 * }} opts  Explicit credentials override env vars.
 * @returns {Promise<{ url: string }>}
 */
async function uploadImage(buffer, {
  key,
  contentType = 'image/jpeg',
  s3Bucket,
  s3Region,
  s3AccessKeyId,
  s3SecretAccessKey,
}) {
  const bucket = s3Bucket || process.env.AWS_S3_BUCKET;
  const region = s3Region || process.env.AWS_REGION || 'us-east-1';
  const accessKeyId     = s3AccessKeyId     || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = s3SecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucket) throw new Error('S3 bucket not configured');

  const clientCfg = { region };
  if (accessKeyId && secretAccessKey) {
    clientCfg.credentials = { accessKeyId, secretAccessKey };
  }

  const client = new S3Client(clientCfg);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${key}.jpg`,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    })
  );

  return { url: `https://${bucket}.s3.${region}.amazonaws.com/${key}.jpg` };
}

module.exports = { uploadImage, isPassthrough: false, S3Client, HeadBucketCommand };
