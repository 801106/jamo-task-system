// app/api/crypto/route.js
// Server-side encryption/decryption endpoint
// ENCRYPTION_KEY is only available server-side — never exposed to client

const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12

async function getKey() {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex) throw new Error('ENCRYPTION_KEY not configured')

  const keyBytes = hexToBytes(keyHex)
  return await crypto.subtle.importKey(
    'raw', keyBytes, { name: ALGORITHM }, false, ['encrypt', 'decrypt']
  )
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(base64) {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

async function encryptValue(value) {
  if (!value || value.toString().trim() === '') return value
  if (typeof value === 'string' && value.startsWith('ENC:')) return value

  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(value.toString())
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded)

  return `ENC:${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`
}

async function decryptValue(value) {
  if (!value || typeof value !== 'string' || !value.startsWith('ENC:')) return value

  const key = await getKey()
  const [ivBase64, ciphertextBase64] = value.substring(4).split('.')
  if (!ivBase64 || !ciphertextBase64) return value

  const iv = base64ToBytes(ivBase64)
  const ciphertext = base64ToBytes(ciphertextBase64)
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}

const ENCRYPTED_FIELDS = ['email', 'phone', 'contact_name', 'notes', 'whatsapp']

async function encryptClient(client) {
  const result = { ...client }
  for (const field of ENCRYPTED_FIELDS) {
    if (result[field]) result[field] = await encryptValue(result[field])
  }
  return result
}

async function decryptClient(client) {
  if (!client) return client
  const result = { ...client }
  for (const field of ENCRYPTED_FIELDS) {
    if (result[field]) result[field] = await decryptValue(result[field])
  }
  return result
}

export async function POST(request) {
  try {
    // Verify request comes from our app (basic auth check)
    const authHeader = request.headers.get('x-internal-key')
    const internalKey = process.env.ENCRYPTION_KEY?.substring(0, 16)
    if (authHeader !== internalKey) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { action, data } = await request.json()

    if (action === 'encrypt_client') {
      const encrypted = await encryptClient(data)
      return Response.json({ success: true, data: encrypted })
    }

    if (action === 'decrypt_client') {
      const decrypted = await decryptClient(data)
      return Response.json({ success: true, data: decrypted })
    }

    if (action === 'decrypt_clients') {
      const decrypted = await Promise.all(data.map(decryptClient))
      return Response.json({ success: true, data: decrypted })
    }

    if (action === 'encrypt_value') {
      const encrypted = await encryptValue(data.value)
      return Response.json({ success: true, value: encrypted })
    }

    if (action === 'decrypt_value') {
      const decrypted = await decryptValue(data.value)
      return Response.json({ success: true, value: decrypted })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err) {
    console.error('Crypto API error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
