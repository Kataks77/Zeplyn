// Utilitário de criptografia AES-256-CBC nativo via Web Crypto API (ponta a ponta com o backend)

const ENCRYPTION_KEY = import.meta.env?.VITE_ENCRYPTION_KEY || '44236bbd6e32b83f3287a53b6babb594';

let cachedGcmKey = null;
let cachedCbcKey = null;

/**
 * Verifica se a Web Crypto API está realmente disponível no contexto atual do navegador.
 * Navegadores modernos só liberam window.crypto.subtle em contextos seguros (HTTPS ou localhost).
 */
export function isCryptoAvailable() {
  try {
    return Boolean(
      typeof window !== 'undefined' &&
      window.crypto &&
      window.crypto.subtle &&
      (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function getGcmKey() {
  if (cachedGcmKey) return cachedGcmKey;
  if (!isCryptoAvailable()) return null;

  const encoder = new TextEncoder();
  const rawKey = encoder.encode(ENCRYPTION_KEY);
  const keyBytes = new Uint8Array(32);
  keyBytes.set(rawKey.subarray(0, 32));

  cachedGcmKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  return cachedGcmKey;
}

async function getCbcKey() {
  if (cachedCbcKey) return cachedCbcKey;
  if (!isCryptoAvailable()) return null;

  const encoder = new TextEncoder();
  const rawKey = encoder.encode(ENCRYPTION_KEY);
  const keyBytes = new Uint8Array(32);
  keyBytes.set(rawKey.subarray(0, 32));

  cachedCbcKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt']
  );
  return cachedCbcKey;
}

/**
 * Criptografa objeto ou string para formato "gcm:ivHex:tagHex:ciphertextHex" (AEAD)
 */
export async function encryptPayload(data) {
  if (data === null || data === undefined) return data;
  if (!isCryptoAvailable()) return null;

  try {
    const key = await getGcmKey();
    if (!key) return null;

    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes IV
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const encoded = new TextEncoder().encode(str);

    const encryptedBuf = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      encoded
    );

    const encryptedBytes = new Uint8Array(encryptedBuf);
    const ciphertextBytes = encryptedBytes.subarray(0, encryptedBytes.length - 16);
    const tagBytes = encryptedBytes.subarray(encryptedBytes.length - 16);

    return `gcm:${bytesToHex(iv)}:${bytesToHex(tagBytes)}:${bytesToHex(ciphertextBytes)}`;
  } catch (error) {
    console.warn('⚠️ [Crypto Frontend] Erro ao criptografar payload AEAD:', error.message);
    return null;
  }
}

/**
 * Descriptografa string AEAD "gcm:ivHex:tagHex:ciphertextHex" ou legado CBC com integridade Fail-Closed
 */
export async function decryptPayload(encryptedStr) {
  if (!encryptedStr || typeof encryptedStr !== 'string') return encryptedStr;
  if (!encryptedStr.includes(':')) return encryptedStr;
  if (!isCryptoAvailable()) return encryptedStr;

  try {
    const parts = encryptedStr.split(':');

    // 1. Formato moderno AEAD AES-256-GCM
    if ((parts[0] === 'gcm' && parts.length === 4) || parts.length === 3) {
      const ivHex = parts[0] === 'gcm' ? parts[1] : parts[0];
      const tagHex = parts[0] === 'gcm' ? parts[2] : parts[1];
      const dataHex = parts[0] === 'gcm' ? parts[3] : parts[2];

      const key = await getGcmKey();
      if (!key) return null;

      const iv = hexToBytes(ivHex);
      const tag = hexToBytes(tagHex);
      const ciphertext = hexToBytes(dataHex);

      const combined = new Uint8Array(ciphertext.length + tag.length);
      combined.set(ciphertext);
      combined.set(tag, ciphertext.length);

      const decryptedBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        key,
        combined
      );

      const text = new TextDecoder().decode(decryptedBuf);
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    // 2. Fallback legado CBC de 2 partes (ivHex:ciphertextHex)
    if (parts.length === 2) {
      const [ivHex, dataHex] = parts;
      const key = await getCbcKey();
      if (!key) return null;

      const iv = hexToBytes(ivHex);
      const ciphertext = hexToBytes(dataHex);

      const decryptedBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-CBC', iv },
        key,
        ciphertext
      );

      const text = new TextDecoder().decode(decryptedBuf);
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return null;
  } catch (error) {
    console.warn('⚠️ [Crypto Frontend] Falha na integridade do payload criptografado:', error.message);
    return null;
  }
}
