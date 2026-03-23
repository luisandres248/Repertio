export const SPOTIFY_CLIENT_ID = '93d1172ca9ac4996abfe12a336dbb720'
export const SPOTIFY_REDIRECT_URI = 'https://repertio.meriland.xyz/callback'
export const SPOTIFY_SCOPES = ['playlist-read-private', 'playlist-read-collaborative']

export const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash']

export const STORAGE_KEYS = {
  spotifySession: 'spotify_session',
  pkceVerifier: 'pkce_verifier',
  oauthState: 'oauth_state',
  geminiApiKey: 'gemini_api_key',
  rememberGeminiKey: 'remember_gemini_key',
} as const
