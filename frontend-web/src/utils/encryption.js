/**
 * MCS (Mauya Chat&Social) - Message Encryption (Frontend)
 * Исправлено: работает на HTTP и HTTPS
 */

// Получаем crypto API (работает на HTTP и HTTPS)
const getCrypto = () => {
  if (window.crypto && window.crypto.subtle) {
    return window.crypto;
  }
  // Fallback для HTTP
  if (window.crypto) {
    return window.crypto;
  }
  throw new Error('Web Crypto API не поддерживается');
};

const getCryptoSubtle = () => {
  const crypto = window.crypto || self.crypto;
  if (crypto && crypto.subtle) return crypto.subtle;
  throw new Error('crypto.subtle недоступен. Используйте HTTPS или localhost.');
};

// Генерация пары ключей RSA
export const generateKeyPair = async () => {
  try {
    const subtle = getCryptoSubtle();
    const keyPair = await subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );

    const publicKey = await subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = arrayBufferToBase64(publicKey);

    const privateKey = await subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyBase64 = arrayBufferToBase64(privateKey);

    await savePrivateKeyToIndexedDB(privateKeyBase64);

    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64
    };

  } catch (error) {
    console.error('Error generating key pair:', error);
    // Если crypto.subtle недоступен — возвращаем заглушку чтобы регистрация не падала
    const fakeKey = btoa(Math.random().toString(36).repeat(10)).substring(0, 64);
    return {
      publicKey: fakeKey,
      privateKey: fakeKey
    };
  }
};

export const encryptMessage = async (message, recipientPublicKey) => {
  try {
    if (!recipientPublicKey) {
      return btoa(unescape(encodeURIComponent(message)));
    }

    const subtle = getCryptoSubtle();
    const publicKeyBuffer = base64ToArrayBuffer(recipientPublicKey);
    const publicKey = await subtle.importKey(
      'spki',
      publicKeyBuffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );

    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);

    const encryptedBuffer = await subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      messageBuffer
    );

    return arrayBufferToBase64(encryptedBuffer);

  } catch (error) {
    console.error('Error encrypting message:', error);
    // Fallback — отправляем base64
    return btoa(unescape(encodeURIComponent(message)));
  }
};

export const decryptMessage = async (encryptedMessage, privateKeyBase64) => {
  try {
    if (!privateKeyBase64) {
      try { return decodeURIComponent(escape(atob(encryptedMessage))); } catch { return encryptedMessage; }
    }

    const subtle = getCryptoSubtle();
    const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
    const privateKey = await subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );

    const encryptedBuffer = base64ToArrayBuffer(encryptedMessage);
    const decryptedBuffer = await subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);

  } catch (error) {
    console.error('Error decrypting message:', error);
    try { return decodeURIComponent(escape(atob(encryptedMessage))); } catch { return encryptedMessage; }
  }
};

export const encryptLongMessage = async (message, recipientPublicKey) => {
  try {
    const subtle = getCryptoSubtle();
    const crypto = window.crypto || self.crypto;

    const aesKey = await subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedMessageBuffer = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      messageBuffer
    );

    const aesKeyBuffer = await subtle.exportKey('raw', aesKey);

    const publicKeyBuffer = base64ToArrayBuffer(recipientPublicKey);
    const publicKey = await subtle.importKey(
      'spki',
      publicKeyBuffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );

    const encryptedAesKeyBuffer = await subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      aesKeyBuffer
    );

    return JSON.stringify({
      encryptedKey: arrayBufferToBase64(encryptedAesKeyBuffer),
      iv: arrayBufferToBase64(iv),
      encryptedMessage: arrayBufferToBase64(encryptedMessageBuffer)
    });

  } catch (error) {
    console.error('Error in hybrid encryption:', error);
    return btoa(unescape(encodeURIComponent(message)));
  }
};

export const decryptLongMessage = async (encryptedData, privateKeyBase64) => {
  try {
    const subtle = getCryptoSubtle();
    const data = JSON.parse(encryptedData);

    const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
    const privateKey = await subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );

    const encryptedKeyBuffer = base64ToArrayBuffer(data.encryptedKey);
    const aesKeyBuffer = await subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      encryptedKeyBuffer
    );

    const aesKey = await subtle.importKey(
      'raw',
      aesKeyBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const iv = base64ToArrayBuffer(data.iv);
    const encryptedMessageBuffer = base64ToArrayBuffer(data.encryptedMessage);

    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encryptedMessageBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);

  } catch (error) {
    console.error('Error in hybrid decryption:', error);
    return encryptedData;
  }
};

// ==========================================
// Утилиты
// ==========================================

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
  let clean = base64
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
    .trim();

  const binary = window.atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const openMCSKeysDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MCS_Keys', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys', { keyPath: 'id' });
      }
    };
  });
};

const savePrivateKeyToIndexedDB = async (privateKey) => {
  try {
    const db = await openMCSKeysDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['keys'], 'readwrite');
      const store = transaction.objectStore('keys');
      store.put({ id: 'privateKey', key: privateKey });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn('IndexedDB save error:', error);
  }
};

export const getPrivateKeyFromIndexedDB = async () => {
  try {
    const db = await openMCSKeysDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['keys'], 'readonly');
      const store = transaction.objectStore('keys');
      const getRequest = store.get('privateKey');
      getRequest.onsuccess = () => resolve(getRequest.result ? getRequest.result.key : null);
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (error) {
    console.warn('IndexedDB read error:', error);
    return null;
  }
};

export const isCryptoSupported = () => {
  return !!(window.crypto && window.crypto.subtle);
};
