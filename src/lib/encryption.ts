import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits — recommended for GCM mode (auth tag is 128 bits)

function getMasterKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_MASTER_KEY
  // Must be exactly 64 hex chars (32 bytes). Validate the CHARSET too — a
  // 64-char string with non-hex chars would silently decode to <32 bytes and
  // fail cryptically later in createCipheriv.
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(keyHex, 'hex')
}

export interface EncryptedPayload {
  encrypted_value: string  // base64 ciphertext
  iv: string               // base64, 12 bytes
  auth_tag: string         // base64, 16 bytes
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getMasterKey()
  const iv = randomBytes(IV_LENGTH)  // fresh random IV every call

  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const auth_tag = cipher.getAuthTag()

  return {
    encrypted_value: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: auth_tag.toString('base64'),
  }
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getMasterKey()
  const iv = Buffer.from(payload.iv, 'base64')
  const encryptedData = Buffer.from(payload.encrypted_value, 'base64')
  const authTag = Buffer.from(payload.auth_tag, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  // cipher.final() throws if auth_tag doesn't match (tamper detected)
  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
