function randomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('')
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
}

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const raw = btoa(String.fromCharCode(...bytes))
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomString(96)
  const challenge = base64url(await sha256(verifier))
  return { verifier, challenge }
}

export function generateOAuthState(): string {
  return randomString(24)
}

export function normalizeName(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ').normalize('NFKC')
}
