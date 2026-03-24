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
  return localStorage.getItem(STORAGE_KEYS.geminiApiKey) ?? ''
}

export function saveGeminiApiKey(value: string): void {
  localStorage.setItem(STORAGE_KEYS.geminiApiKey, value)
}

export function clearGeminiApiKey(): void {
  localStorage.removeItem(STORAGE_KEYS.geminiApiKey)
}
