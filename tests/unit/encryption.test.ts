import { describe, it, expect, afterEach } from 'vitest'
import { encrypt, decrypt } from '@/lib/encryption'

describe('AES-256-GCM Encryption', () => {
  it('should produce base64 iv, encrypted_value, and auth_tag', () => {
    const result = encrypt('my-secret-value')

    expect(result.iv).toBeTruthy()
    expect(result.encrypted_value).toBeTruthy()
    expect(result.auth_tag).toBeTruthy()

    // All fields should be valid base64
    expect(() => Buffer.from(result.iv, 'base64')).not.toThrow()
    expect(() => Buffer.from(result.encrypted_value, 'base64')).not.toThrow()
    expect(() => Buffer.from(result.auth_tag, 'base64')).not.toThrow()
  })

  it('iv should be 12 bytes (96 bits, required for GCM)', () => {
    const result = encrypt('test')
    const ivBytes = Buffer.from(result.iv, 'base64')
    expect(ivBytes.length).toBe(12)
  })

  it('auth_tag should be 16 bytes (128 bits)', () => {
    const result = encrypt('test')
    const tagBytes = Buffer.from(result.auth_tag, 'base64')
    expect(tagBytes.length).toBe(16)
  })

  it('should decrypt back to original plaintext (round-trip)', () => {
    const plaintext = 'DATABASE_PASSWORD=hunter2'
    const encrypted = encrypt(plaintext)
    expect(decrypt(encrypted)).toBe(plaintext)
  })

  it('should produce a different IV on each call (never reuse nonce)', () => {
    const a = encrypt('same-value')
    const b = encrypt('same-value')
    expect(a.iv).not.toBe(b.iv)
    expect(a.encrypted_value).not.toBe(b.encrypted_value)
  })

  it('should handle empty string', () => {
    const encrypted = encrypt('')
    expect(decrypt(encrypted)).toBe('')
  })

  it('should handle unicode and emoji characters', () => {
    const plaintext = 'パスワード🔑 = s3cr3t!@#'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('should handle long secrets', () => {
    const plaintext = 'x'.repeat(10000)
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('should throw if auth_tag is tampered (tamper detection)', () => {
    const encrypted = encrypt('sensitive-data')
    const tampered = {
      ...encrypted,
      auth_tag: Buffer.alloc(16, 0).toString('base64'), // all-zero tag
    }
    expect(() => decrypt(tampered)).toThrow()
  })

  it('should throw if ciphertext is tampered', () => {
    const encrypted = encrypt('sensitive-data')
    const ciphertextBytes = Buffer.from(encrypted.encrypted_value, 'base64')
    ciphertextBytes[0] ^= 0xff // flip first byte bits
    const tampered = {
      ...encrypted,
      encrypted_value: ciphertextBytes.toString('base64'),
    }
    expect(() => decrypt(tampered)).toThrow()
  })

  it('should throw if IV is tampered', () => {
    const encrypted = encrypt('sensitive-data')
    const ivBytes = Buffer.from(encrypted.iv, 'base64')
    ivBytes[0] ^= 0xff
    const tampered = {
      ...encrypted,
      iv: ivBytes.toString('base64'),
    }
    expect(() => decrypt(tampered)).toThrow()
  })

  describe('master key validation', () => {
    const original = process.env.ENCRYPTION_MASTER_KEY

    afterEach(() => {
      process.env.ENCRYPTION_MASTER_KEY = original
    })

    it('should throw a clear error if ENCRYPTION_MASTER_KEY is missing', () => {
      delete process.env.ENCRYPTION_MASTER_KEY
      expect(() => encrypt('test')).toThrow('ENCRYPTION_MASTER_KEY')
    })

    it('should throw if ENCRYPTION_MASTER_KEY is too short', () => {
      process.env.ENCRYPTION_MASTER_KEY = 'abc'
      expect(() => encrypt('test')).toThrow('ENCRYPTION_MASTER_KEY')
    })

    it('should throw if ENCRYPTION_MASTER_KEY is too long', () => {
      process.env.ENCRYPTION_MASTER_KEY = 'a'.repeat(65)
      expect(() => encrypt('test')).toThrow('ENCRYPTION_MASTER_KEY')
    })
  })
})
