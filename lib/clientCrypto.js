// lib/clientCrypto.js
// Client-side helper that calls server-side crypto API
// ENCRYPTION_KEY never leaves the server

const INTERNAL_KEY = process.env.NEXT_PUBLIC_INTERNAL_KEY || ''

async function callCryptoAPI(action, data) {
  const response = await fetch('/api/crypto', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': process.env.NEXT_PUBLIC_CRYPTO_HEADER || '',
    },
    body: JSON.stringify({ action, data })
  })
  if (!response.ok) throw new Error('Crypto API error')
  return response.json()
}

// Encrypt client before saving to Supabase
export async function encryptClientData(client) {
  try {
    const result = await callCryptoAPI('encrypt_client', client)
    return result.data
  } catch (err) {
    console.error('Encrypt client error:', err)
    return client // Return unencrypted if fails
  }
}

// Decrypt single client after reading from Supabase
export async function decryptClientData(client) {
  if (!client) return client
  try {
    const result = await callCryptoAPI('decrypt_client', client)
    return result.data
  } catch (err) {
    console.error('Decrypt client error:', err)
    return client
  }
}

// Decrypt array of clients
export async function decryptClientsData(clients) {
  if (!clients || clients.length === 0) return clients
  try {
    const result = await callCryptoAPI('decrypt_clients', clients)
    return result.data
  } catch (err) {
    console.error('Decrypt clients error:', err)
    return clients
  }
}

// Check if value is encrypted
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('ENC:')
}

// Check if any client field is encrypted
export function clientHasEncryptedData(client) {
  if (!client) return false
  return ['email', 'phone', 'contact_name', 'notes'].some(f => isEncrypted(client[f]))
}
