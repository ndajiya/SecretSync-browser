//Wallet-Based AES Key Derivation
export async function getWalletDerivedAESKey(messageToSign = "kairotech-secure-key-v1") {
  const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });

  const signature = await window.ethereum.request({
    method: 'personal_sign',
    params: [messageToSign, address],
  });

  const encoder = new TextEncoder();
  const signatureBuffer = encoder.encode(signature);
  const hashBuffer = await crypto.subtle.digest('SHA-256', signatureBuffer);

  return await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt/Decrypt with AES-GCM
export async function encryptDataAES(plainObject, aesKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(plainObject));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    dataBuffer
  );

  return {
    encrypted: Buffer.from(encryptedBuffer).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
  };
}

export async function decryptDataAES({ encrypted, iv }, aesKey) {
  const encryptedBuffer = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    aesKey,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decryptedBuffer));
}
