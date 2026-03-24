import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES, STORAGE_KEYS } from './config'
import { generateOAuthState, generatePkcePair, normalizeName } from './pkce'
import type { ResolvedArtist, SeedArtist, SpotifyPlaylist, SpotifySession } from './types'

const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com'
const SPOTIFY_API_URL = 'https://api.spotify.com/v1'

type SpotifyTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

type SpotifyPlaylistPage = {
  items: Array<{
    id?: string
    name?: string
    owner?: { display_name?: string; id?: string }
    tracks?: { total?: number }
    collaborative?: boolean
    public?: boolean | null
  }>
  next: string | null
}

type SpotifyTrackItemsPage = {
  total?: number
  items: Array<{
    track?: {
      id: string | null
      artists: Array<{ id: string | null; name: string }>
    } | null
    item?: {
      id: string | null
      artists: Array<{ id: string | null; name: string }>
    } | null
    is_local: boolean
  }>
  next: string | null
}

async function fetchToken(body: URLSearchParams): Promise<SpotifyTokenResponse> {
  const response = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`Spotify token error: ${response.status}`)
  }

  return response.json()
}

export async function startSpotifyLogin(): Promise<void> {
  const { verifier, challenge } = await generatePkcePair()
  const state = generateOAuthState()

  sessionStorage.setItem(STORAGE_KEYS.pkceVerifier, verifier)
  sessionStorage.setItem(STORAGE_KEYS.oauthState, state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  })

  window.location.href = `${SPOTIFY_ACCOUNTS_URL}/authorize?${params.toString()}`
}

export async function exchangeCodeForSession(code: string, state: string | null): Promise<SpotifySession> {
  const verifier = sessionStorage.getItem(STORAGE_KEYS.pkceVerifier)
  const savedState = sessionStorage.getItem(STORAGE_KEYS.oauthState)

  if (!verifier || !state || !savedState || savedState !== state) {
    throw new Error('Invalid OAuth state')
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: verifier,
  })

  const data = await fetchToken(body)

  sessionStorage.removeItem(STORAGE_KEYS.pkceVerifier)
  sessionStorage.removeItem(STORAGE_KEYS.oauthState)

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    tokenType: data.token_type,
    expiresAt: Date.now() + data.expires_in * 1000,
    scopes: data.scope.split(' ').filter(Boolean),
  }
}

export async function refreshSpotifySession(session: SpotifySession): Promise<SpotifySession> {
  if (!session.refreshToken) {
    throw new Error('Missing refresh token')
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    client_id: SPOTIFY_CLIENT_ID,
  })

  const data = await fetchToken(body)

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? session.refreshToken,
    tokenType: data.token_type,
    expiresAt: Date.now() + data.expires_in * 1000,
    scopes: data.scope.split(' ').filter(Boolean),
  }
}

export function hasExpired(session: SpotifySession): boolean {
  return Date.now() > session.expiresAt - 60_000
}

async function fetchPlaylistTrackCount(accessToken: string, playlistId: string): Promise<number | null> {
  const response = await fetch(`${SPOTIFY_API_URL}/playlists/${playlistId}/items?limit=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (response.status === 403 || response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Spotify playlist probe error: ${response.status} (${playlistId})`)
  }

  const data = (await response.json()) as SpotifyTrackItemsPage
  return data.total ?? 0
}

export async function fetchPlaylists(accessToken: string): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = []
  let nextUrl: string | null = `${SPOTIFY_API_URL}/me/playlists?limit=50`

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`Spotify playlists error: ${response.status}`)
    }

    const data = (await response.json()) as SpotifyPlaylistPage

    const currentPage = await Promise.all(
      data.items.map(async (item) => {
        if (!item.id || !item.name || !item.owner?.id) return null

        const tracksTotal = await fetchPlaylistTrackCount(accessToken, item.id)
        if (tracksTotal === null) return null

        return {
          id: item.id,
          name: item.name,
          ownerName: item.owner.display_name ?? 'Unknown owner',
          ownerId: item.owner.id,
          tracksTotal,
          collaborative: item.collaborative ?? false,
          isPublic: item.public ?? null,
        } satisfies SpotifyPlaylist
      }),
    )

    playlists.push(...currentPage.filter((item): item is SpotifyPlaylist => item !== null))

    nextUrl = data.next
  }

  return playlists
}

export async function fetchSeedArtists(
  accessToken: string,
  playlistIds: string[],
): Promise<SeedArtist[]> {
  const counts = new Map<string, SeedArtist>()

  for (const playlistId of playlistIds) {
    let nextUrl: string | null = `${SPOTIFY_API_URL}/playlists/${playlistId}/items?limit=100`

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        throw new Error(`Spotify playlist tracks error: ${response.status} (${playlistId})`)
      }

      const data = (await response.json()) as SpotifyTrackItemsPage
      for (const item of data.items) {
        const playlistItem = item.item ?? item.track
        if (!playlistItem || item.is_local) continue

        for (const artist of playlistItem.artists) {
          const key = normalizeName(artist.name)
          const existing = counts.get(key)

          if (existing) {
            existing.count += 1
            if (!existing.spotifyId && artist.id) {
              existing.spotifyId = artist.id
            }
          } else {
            counts.set(key, {
              name: artist.name,
              spotifyId: artist.id,
              count: 1,
            })
          }
        }
      }

      nextUrl = data.next
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count)
}

export async function resolveArtistOnSpotify(
  accessToken: string,
  name: string,
  seedIds: Set<string>,
  seedNames: Set<string>,
  description: string,
  whyFits: string,
  confidence: number,
): Promise<ResolvedArtist> {
  const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(name)}`
  const normalizedInput = normalizeName(name)

  const response = await fetch(
    `${SPOTIFY_API_URL}/search?type=artist&limit=5&q=${encodeURIComponent(`artist:${name}`)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!response.ok) {
    return {
      name,
      description,
      whyFits,
      confidence,
      spotifyUrl: null,
      searchUrl,
      status: 'not_found',
    }
  }

  const data = (await response.json()) as {
    artists?: { items?: Array<{ id: string; name: string; external_urls?: { spotify?: string } }> }
  }

  const items = data.artists?.items ?? []
  if (items.length === 0) {
    return {
      name,
      description,
      whyFits,
      confidence,
      spotifyUrl: null,
      searchUrl,
      status: 'not_found',
    }
  }

  const best = items[0]
  const bestName = normalizeName(best.name)

  if (seedIds.has(best.id) || seedNames.has(bestName) || seedNames.has(normalizedInput)) {
    return {
      name,
      description,
      whyFits,
      confidence,
      spotifyUrl: best.external_urls?.spotify ?? null,
      searchUrl,
      status: 'filtered_duplicate',
    }
  }

  const isExact = bestName === normalizedInput
  const ambiguous = !isExact && items.length > 1

  return {
    name,
    description,
    whyFits,
    confidence,
    spotifyUrl: best.external_urls?.spotify ?? null,
    searchUrl,
    status: ambiguous ? 'ambiguous' : 'matched',
  }
}
