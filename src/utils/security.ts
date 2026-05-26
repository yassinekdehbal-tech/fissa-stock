export async function hashPassword(pwd: string): Promise<string> {
  const data = new TextEncoder().encode(pwd + 'fissa_salt_2024')
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function sanitize(str: string): string {
  if (typeof str !== 'string') return str
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export function generateSessionToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60000
let attempts = 0
let lockUntil = 0

export function checkRateLimit(): { blocked: boolean; msg?: string } {
  if (Date.now() < lockUntil) {
    const secs = Math.ceil((lockUntil - Date.now()) / 1000)
    return { blocked: true, msg: `Trop de tentatives. Réessayez dans ${secs}s` }
  }
  return { blocked: false }
}

export function recordAttempt(success: boolean): void {
  if (success) { attempts = 0; lockUntil = 0; return }
  attempts++
  if (attempts >= MAX_ATTEMPTS) {
    lockUntil = Date.now() + LOCKOUT_MS
    attempts = 0
  }
}
