import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { generateRecommendations } from './lib/gemini'
import { normalizeName } from './lib/pkce'
import {
  exchangeCodeForSession,
  fetchPlaylists,
  fetchSeedArtists,
  hasExpired,
  refreshSpotifySession,
  resolveArtistOnSpotify,
  startSpotifyLogin,
} from './lib/spotify'
import {
  clearGeminiApiKey,
  clearSpotifySession,
  loadGeminiApiKey,
  loadSpotifySession,
  saveGeminiApiKey,
  saveSpotifySession,
} from './lib/storage'
import type { ResolvedGroup, SeedArtist, SpotifyPlaylist, SpotifySession } from './lib/types'
import { PrivacyPage } from './pages/PrivacyPage'
import { SettingsPage } from './pages/SettingsPage'
import { TermsPage } from './pages/TermsPage'

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error'
type GenerationStatus = 'idle' | 'running' | 'error' | 'done'

function CallbackPage({
  onSession,
}: {
  onSession: (session: SpotifySession) => void
}) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')

    async function run() {
      if (oauthError) {
        setError(`Spotify OAuth error: ${oauthError}`)
        return
      }

      if (!code) {
        setError('No code found in callback URL')
        return
      }

      try {
        const session = await exchangeCodeForSession(code, state)
        saveSpotifySession(session)
        onSession(session)
        window.history.replaceState({}, document.title, '/callback')
        navigate('/')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown callback error')
      }
    }

    void run()
  }, [navigate, onSession, searchParams])

  return (
    <main className="page">
      <h1>Procesando login...</h1>
      {error ? <p className="error">{error}</p> : <p>Espera un momento mientras validamos Spotify.</p>}
      <p>
        <Link to="/">Volver</Link>
      </p>
    </main>
  )
}

function AppHome({
  session,
  authStatus,
  authError,
  playlists,
  playlistsLoading,
  playlistsError,
  playlistsNotice,
  selectedIds,
  onToggleSelection,
  onLogin,
  onLogout,
  onGenerate,
  generationStatus,
  generationError,
  results,
  seedArtists,
}: {
  session: SpotifySession | null
  authStatus: AuthStatus
  authError: string | null
  playlists: SpotifyPlaylist[]
  playlistsLoading: boolean
  playlistsError: string | null
  playlistsNotice: string | null
  selectedIds: Set<string>
  onToggleSelection: (playlistId: string) => void
  onLogin: () => void
  onLogout: () => void
  onGenerate: () => void
  generationStatus: GenerationStatus
  generationError: string | null
  results: ResolvedGroup[]
  seedArtists: SeedArtist[]
}) {
  const selectedPlaylists = useMemo(
    () => playlists.filter((p) => selectedIds.has(p.id)),
    [playlists, selectedIds],
  )

  if (authStatus === 'loading') {
    return (
      <main className="page">
        <h1>Repertio</h1>
        <p>Cargando sesion...</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="page">
        <h1>Repertio</h1>
        <p>Descubre artistas nuevos desde tus playlists de Spotify.</p>
        {authError ? <p className="error">{authError}</p> : null}
        <button className="button" onClick={onLogin} disabled={authStatus === 'error'}>
          Connect Spotify
        </button>
      </main>
    )
  }

  return (
    <main className="page">
      <h1>Repertio</h1>
      <p>Sesion Spotify activa.</p>

      <section className="panel row">
        <div>
          <h2>Playlists</h2>
          <p>Selecciona una o varias playlists para generar recomendaciones.</p>
        </div>
        <button className="button secondary" onClick={onLogout}>
          Logout
        </button>
      </section>

      {playlistsLoading ? <p>Cargando playlists...</p> : null}
      {playlistsError ? <p className="error">{playlistsError}</p> : null}
      {playlistsNotice ? <p className="notice">{playlistsNotice}</p> : null}

      {!playlistsLoading && playlists.length === 0 ? <p>No se encontraron playlists.</p> : null}

      {playlists.length > 0 ? (
        <section className="panel">
          <ul className="playlist-list">
            {playlists.map((playlist) => (
              <li key={playlist.id}>
                <label className="checkbox playlist-item">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(playlist.id)}
                    onChange={() => onToggleSelection(playlist.id)}
                  />
                  <span className="playlist-main">
                    <strong>{playlist.name}</strong>
                    <small>
                      {playlist.ownerName} - {playlist.tracksTotal} tracks
                    </small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel row">
        <div>
          <h2>Generar</h2>
          <p>
            Seleccionadas: {selectedPlaylists.length}. Artistas semilla encontrados: {seedArtists.length || 'n/a'}.
          </p>
        </div>
        <button
          className="button"
          onClick={onGenerate}
          disabled={generationStatus === 'running' || selectedIds.size === 0}
        >
          {generationStatus === 'running' ? 'Generando...' : 'Generate recommendations'}
        </button>
      </section>

      {generationError ? <p className="error">{generationError}</p> : null}

      {results.length > 0 ? (
        <section className="results-grid">
          {results.map((group) => (
            <article key={group.id} className="panel">
              <h3>{group.title}</h3>
              <p>
                <strong>Criterio:</strong> {group.criterion}
              </p>
              <p>{group.rationale}</p>
              <ul>
                {group.artists.map((artist) => (
                  <li key={`${group.id}-${artist.name}`} className="artist-item">
                    <div>
                      <strong>{artist.name}</strong> <small>({Math.round(artist.confidence * 100)}%)</small>
                      <p>{artist.description}</p>
                      <p>{artist.whyFits}</p>
                      <small>Estado: {artist.status}</small>
                    </div>
                    <div className="artist-links">
                      {artist.spotifyUrl ? (
                        <a href={artist.spotifyUrl} target="_blank" rel="noreferrer">
                          Abrir en Spotify
                        </a>
                      ) : null}
                      <a href={artist.searchUrl} target="_blank" rel="noreferrer">
                        Buscar en Spotify
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  )
}

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')
  const [authError, setAuthError] = useState<string | null>(null)
  const [session, setSession] = useState<SpotifySession | null>(null)

  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  const [playlistsError, setPlaylistsError] = useState<string | null>(null)
  const [playlistsNotice, setPlaylistsNotice] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [seedArtists, setSeedArtists] = useState<SeedArtist[]>([])
  const [results, setResults] = useState<ResolvedGroup[]>([])
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle')
  const [generationError, setGenerationError] = useState<string | null>(null)

  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null)

  useEffect(() => {
    const saved = loadSpotifySession()
    if (!saved) {
      setAuthStatus('anonymous')
      return
    }
    const savedSession = saved

    async function init() {
      try {
        let nextSession = savedSession
        if (hasExpired(savedSession)) {
          nextSession = await refreshSpotifySession(savedSession)
          saveSpotifySession(nextSession)
        }

        setSession(nextSession)
        setAuthStatus('authenticated')
      } catch {
        clearSpotifySession()
        setAuthStatus('anonymous')
      }
    }

    void init()

    const key = loadGeminiApiKey()
    setGeminiApiKey(key)
  }, [])

  useEffect(() => {
    if (!session) return
    const activeSession = session

    async function run() {
      setPlaylistsLoading(true)
      setPlaylistsError(null)
      setPlaylistsNotice(null)

      try {
        const data = await fetchPlaylists(activeSession.accessToken)
        setPlaylists(data)
        setPlaylistsNotice('Solo se muestran playlists cuyos tracks Spotify permite leer con tu sesion actual.')
      } catch (error) {
        setPlaylistsError(error instanceof Error ? error.message : 'No se pudieron cargar playlists')
      } finally {
        setPlaylistsLoading(false)
      }
    }

    void run()
  }, [session])

  const handleSetSession = (next: SpotifySession) => {
    setSession(next)
    setAuthError(null)
    setAuthStatus('authenticated')
  }

  const handleLogin = () => {
    setAuthStatus('loading')
    setAuthError(null)
    void startSpotifyLogin().catch((error) => {
      setAuthError(error instanceof Error ? error.message : 'No se pudo iniciar login')
      setAuthStatus('error')
    })
  }

  const handleLogout = () => {
    clearSpotifySession()
    setSession(null)
    setPlaylists([])
    setSelectedIds(new Set())
    setSeedArtists([])
    setResults([])
    setAuthStatus('anonymous')
  }

  const handleToggleSelection = (playlistId: string) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev)
      if (copy.has(playlistId)) {
        copy.delete(playlistId)
      } else {
        if (copy.size >= 5) return copy
        copy.add(playlistId)
      }
      return copy
    })
  }

  const handleSaveSettings = () => {
    if (!geminiApiKey.trim()) {
      setSettingsNotice('Ingresa una Gemini API key valida antes de guardarla.')
      return
    }

    const normalizedKey = geminiApiKey.trim()
    saveGeminiApiKey(normalizedKey)
    setGeminiApiKey(normalizedKey)
    setSettingsNotice('Gemini API key guardada localmente en este navegador.')
  }

  const handleClearSettings = () => {
    clearGeminiApiKey()
    setGeminiApiKey('')
    setSettingsNotice('Gemini API key eliminada de este navegador.')
  }

  const handleApiKeyChange = (value: string) => {
    setGeminiApiKey(value)
    setSettingsNotice(null)
  }

  const handleGenerate = async () => {
    if (!session) return
    if (!geminiApiKey.trim()) {
      setGenerationStatus('error')
      setGenerationError('Gemini API key faltante. Configurala en Settings.')
      return
    }

    if (selectedIds.size === 0) {
      setGenerationStatus('error')
      setGenerationError('Selecciona al menos una playlist.')
      return
    }

    try {
      setGenerationStatus('running')
      setGenerationError(null)
      setResults([])

      const playlistIds = [...selectedIds]
      const selectedPlaylists = playlists.filter((p) => selectedIds.has(p.id))

      const seeds = await fetchSeedArtists(session.accessToken, playlistIds)
      setSeedArtists(seeds)

      if (seeds.length === 0) {
        throw new Error('No se encontraron artistas semilla en las playlists seleccionadas.')
      }

      const gemini = await generateRecommendations(
        geminiApiKey.trim(),
        seeds,
        selectedPlaylists.map((p) => p.name),
      )

      const seedIds = new Set(seeds.filter((x) => x.spotifyId).map((x) => x.spotifyId as string))
      const seedNames = new Set(seeds.map((x) => normalizeName(x.name)))
      const seen = new Set<string>()

      const resolvedGroups: ResolvedGroup[] = []
      for (const group of gemini.groups) {
        const resolvedArtists = await Promise.all(
          group.recommendedArtists.map((artist) =>
            resolveArtistOnSpotify(
              session.accessToken,
              artist.name,
              seedIds,
              seedNames,
              artist.description,
              artist.whyFits,
              artist.confidence,
            ),
          ),
        )

        const deduped = resolvedArtists.filter((artist) => {
          if (artist.status === 'filtered_duplicate') return false
          const key = normalizeName(artist.name)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        if (deduped.length >= 2) {
          resolvedGroups.push({
            id: group.id,
            title: group.title,
            criterion: group.criterion,
            rationale: group.rationale,
            artists: deduped,
          })
        }
      }

      if (resolvedGroups.length === 0) {
        throw new Error('No quedaron recomendaciones validas luego de filtrar duplicados.')
      }

      setResults(resolvedGroups)
      setGenerationStatus('done')
    } catch (error) {
      setGenerationStatus('error')
      setGenerationError(error instanceof Error ? error.message : 'Fallo en la generacion')
    }
  }

  return (
    <BrowserRouter>
      <div className="shell">
        <header className="topbar">
          <Link to="/" className="brand">
            <img src="/logo-mark.svg" alt="" className="brand-mark" />
            <span className="brand-copy">
              <span className="brand-name">Repertio</span>
              <span className="brand-tagline">Curaduria musical de camara imperial</span>
            </span>
          </Link>
          <nav>
            <Link to="/settings">Settings</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
        </header>

        <Routes>
          <Route
            path="/"
            element={
              <AppHome
                session={session}
                authStatus={authStatus}
                authError={authError}
                playlists={playlists}
                playlistsLoading={playlistsLoading}
                playlistsError={playlistsError}
                playlistsNotice={playlistsNotice}
                selectedIds={selectedIds}
                onToggleSelection={handleToggleSelection}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onGenerate={handleGenerate}
                generationStatus={generationStatus}
                generationError={generationError}
                results={results}
                seedArtists={seedArtists}
              />
            }
          />
          <Route path="/callback" element={<CallbackPage onSession={handleSetSession} />} />
          <Route
            path="/settings"
            element={
              <SettingsPage
                apiKey={geminiApiKey}
                notice={settingsNotice}
                onApiKeyChange={handleApiKeyChange}
                onSave={handleSaveSettings}
                onClear={handleClearSettings}
              />
            }
          />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
