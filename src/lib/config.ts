function requireEnv(value: string | undefined, key: string): string {
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value
}

export const SPOTIFY_CLIENT_ID = requireEnv(import.meta.env.VITE_SPOTIFY_CLIENT_ID, 'VITE_SPOTIFY_CLIENT_ID')
export const SPOTIFY_REDIRECT_URI = requireEnv(
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
  'VITE_SPOTIFY_REDIRECT_URI',
)
export const SPOTIFY_SCOPES = ['playlist-read-private', 'playlist-read-collaborative']

export const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash']

export const STORAGE_KEYS = {
  spotifySession: 'spotify_session',
  pkceVerifier: 'pkce_verifier',
  oauthState: 'oauth_state',
  geminiApiKey: 'gemini_api_key',
  rememberGeminiKey: 'remember_gemini_key',
} as const
