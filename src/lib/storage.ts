import { STORAGE_KEYS } from './config'
import type { SpotifySession } from './types'

export function loadSpotifySession(): SpotifySession | null {
  const raw = sessionStorage.getItem(STORAGE_KEYS.spotifySession)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as SpotifySession
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSpotifySession(session: SpotifySession): void {
  sessionStorage.setItem(STORAGE_KEYS.spotifySession, JSON.stringify(session))
}

export function clearSpotifySession(): void {
  sessionStorage.removeItem(STORAGE_KEYS.spotifySession)
}

export function loadGeminiApiKey(): string {
  const remember = localStorage.getItem(STORAGE_KEYS.rememberGeminiKey) === 'true'
  if (!remember) return ''
  return localStorage.getItem(STORAGE_KEYS.geminiApiKey) ?? ''
}

export function saveGeminiApiKey(value: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(STORAGE_KEYS.rememberGeminiKey, 'true')
    localStorage.setItem(STORAGE_KEYS.geminiApiKey, value)
    return
  }

  localStorage.setItem(STORAGE_KEYS.rememberGeminiKey, 'false')
  localStorage.removeItem(STORAGE_KEYS.geminiApiKey)
}
