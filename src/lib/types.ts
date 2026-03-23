export type LoginStatus = 'idle' | 'loading' | 'authenticated' | 'error'

export type SpotifySession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tokenType: string
  scopes: string[]
}

export type SpotifyPlaylist = {
  id: string
  name: string
  ownerName: string
  ownerId: string
  tracksTotal: number
  collaborative: boolean
  isPublic: boolean | null
}

export type SeedArtist = {
  name: string
  spotifyId: string | null
  count: number
}

export type RecommendedArtist = {
  name: string
  description: string
  whyFits: string
  confidence: number
}

export type RecommendationGroup = {
  id: string
  title: string
  criterion: string
  rationale: string
  recommendedArtists: RecommendedArtist[]
}

export type GeminiResponse = {
  version: string
  summary: string
  groups: RecommendationGroup[]
}

export type ResolvedArtist = {
  name: string
  description: string
  whyFits: string
  confidence: number
  spotifyUrl: string | null
  searchUrl: string
  status: 'matched' | 'ambiguous' | 'not_found' | 'filtered_duplicate'
}

export type ResolvedGroup = {
  id: string
  title: string
  criterion: string
  rationale: string
  artists: ResolvedArtist[]
}
