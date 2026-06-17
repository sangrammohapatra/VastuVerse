/**
 * Passthrough storage provider — returns the source URL unchanged.
 * Active when neither CLOUDINARY_URL nor AWS_S3_BUCKET is configured.
 */

async function uploadImage(_buffer, _opts) {
  throw new Error('passthrough provider does not upload — caller should short-circuit');
}

module.exports = { uploadImage, isPassthrough: true };
