import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export const encrypt = (plainText) => {
  const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // ← read here, not top level
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decrypt = (encryptedText) => {
  const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // ← read here too
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};