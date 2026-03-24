import { useEffect, useState } from 'react'
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
import type { ResolvedGroup, SpotifyPlaylist, SpotifySession } from './lib/types'
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
  selectedIds,
  onToggleSelection,
  onLogin,
  onLogout,
  onGenerate,
  generationStatus,
  generationError,
  results,
  currentResultIndex,
  onPrevResult,
  onNextResult,
}: {
  session: SpotifySession | null
  authStatus: AuthStatus
  authError: string | null
  playlists: SpotifyPlaylist[]
  playlistsLoading: boolean
  playlistsError: string | null
  selectedIds: Set<string>
  onToggleSelection: (playlistId: string) => void
  onLogin: () => void
  onLogout: () => void
  onGenerate: () => void
  generationStatus: GenerationStatus
  generationError: string | null
  results: ResolvedGroup[]
  currentResultIndex: number
  onPrevResult: () => void
  onNextResult: () => void
}) {
  const currentGroup = results[currentResultIndex] ?? null

  if (authStatus === 'loading') {
    return (
      <main className="page">
        <h1>REPERTIO</h1>
        <p>Cargando...</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="page">
        <h1>REPERTIO</h1>
        <p>Descubre artistas nuevos desde tus playlists de Spotify.</p>
        {authError ? <p className="error">{authError}</p> : null}
        <button className="button" onClick={onLogin} disabled={authStatus === 'error'}>
          Conectar Spotify
        </button>
      </main>
    )
  }

  return (
    <main className="page">
      <h1>REPERTIO</h1>
      <p>Descubre artistas nuevos desde las playlists que ya conoces.</p>

      <section className="panel row">
        <div>
          <h2>Playlists</h2>
          <p>Selecciona una o varias playlists para generar recomendaciones.</p>
        </div>
        <button className="button secondary" onClick={onLogout}>
          Salir
        </button>
      </section>

      {playlistsLoading ? <p>Cargando playlists...</p> : null}
      {playlistsError ? <p className="error">{playlistsError}</p> : null}

      {!playlistsLoading && playlists.length === 0 ? <p>No se encontraron playlists.</p> : null}

      {playlists.length > 0 ? (
        <section className="panel">
          <div className="playlist-list-shell">
            <ul className="playlist-list">
              {playlists.map((playlist) => (
                <li key={playlist.id}>
                  <label className="checkbox playlist-item">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(playlist.id)}
                      onChange={() => onToggleSelection(playlist.id)}
                    />
                    {playlist.imageUrl ? (
                      <img src={playlist.imageUrl} alt="" className="playlist-cover" />
                    ) : (
                      <span className="playlist-cover fallback" />
                    )}
                    <span className="playlist-main">
                      <span className="playlist-headline">
                        <strong>{playlist.name}</strong>
                        <small>{playlist.ownerName}</small>
                        <span className="playlist-stats">
                          <span>{playlist.tracksTotal} tracks</span>
                          {playlist.isPublic ? <span>public</span> : <span>private</span>}
                        {playlist.averagePopularity !== null ? <span>popularidad {playlist.averagePopularity}</span> : null}
                        </span>
                      </span>
                      {playlist.description ? <p className="playlist-description">{playlist.description}</p> : null}
                      {playlist.sampleArtists.length > 0 ? (
                        <p className="playlist-meta">
                          {playlist.sampleArtists.join(' • ')}
                        </p>
                      ) : null}
                      {playlist.sampleGenres.length > 0 ? (
                        <p className="playlist-meta subtle">
                          {playlist.sampleGenres.join(' • ')}
                        </p>
                      ) : null}
                      {playlist.spotifyUrl ? (
                        <a href={playlist.spotifyUrl} target="_blank" rel="noreferrer" className="inline-link">
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="external-icon">
                            <path d="M14 5h5v5h-2V8.41l-6.29 6.3-1.42-1.42 6.3-6.29H14V5Z" fill="currentColor" />
                            <path d="M7 7h5v2H9v6h6v-3h2v5H7V7Z" fill="currentColor" />
                          </svg>
                        </a>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="panel row">
        <div>
          <h2>Generar</h2>
          <p>Elige hasta 5 playlists para generar recomendaciones de artistas.</p>
        </div>
        <button
          className="button"
          onClick={onGenerate}
          disabled={generationStatus === 'running' || selectedIds.size === 0}
        >
          {generationStatus === 'running' ? 'Generando...' : 'Generar recomendaciones'}
        </button>
      </section>

      {generationError ? <p className="error">{generationError}</p> : null}

      {currentGroup ? (
        <section className="results-grid">
          <div className="carousel-controls">
            <button className="button secondary" onClick={onPrevResult}>
              Anterior
            </button>
            <span className="carousel-indicator">
              {currentResultIndex + 1}/{results.length}
            </span>
            <button className="button secondary" onClick={onNextResult}>
              Siguiente
            </button>
          </div>
          <article key={currentGroup.id} className="panel">
              <div className="recommendation-header">
                <h3>{currentGroup.title}</h3>
                <p className="recommendation-criterion">{currentGroup.criterion}</p>
              </div>
              <p className="recommendation-rationale">{currentGroup.rationale}</p>
              <ul>
                {currentGroup.artists.map((artist) => (
                  <li key={`${currentGroup.id}-${artist.name}`} className="artist-item">
                    <div className="artist-main">
                      {artist.imageUrl ? <img src={artist.imageUrl} alt="" className="artist-image" /> : <span className="artist-image fallback" />}
                      <div className="artist-copy">
                        <strong>{artist.name}</strong>
                        <p className="artist-description">{artist.description}</p>
                        <p className="artist-fit">{artist.whyFits}</p>
                      </div>
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [results, setResults] = useState<ResolvedGroup[]>([])
  const [currentResultIndex, setCurrentResultIndex] = useState(0)
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

      try {
        const data = await fetchPlaylists(activeSession.accessToken)
        setPlaylists(data)
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
    setResults([])
    setCurrentResultIndex(0)
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
      setGenerationError('Falta la Gemini API key. Configúrala en Configuración.')
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
      setCurrentResultIndex(0)

      const playlistIds = [...selectedIds]
      const selectedPlaylists = playlists.filter((p) => selectedIds.has(p.id))

      const seeds = await fetchSeedArtists(session.accessToken, playlistIds)

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
      setCurrentResultIndex(0)
      setGenerationStatus('done')
    } catch (error) {
      setGenerationStatus('error')
      setGenerationError(error instanceof Error ? error.message : 'Fallo en la generacion')
    }
  }

  const handlePrevResult = () => {
    setCurrentResultIndex((prev) => (results.length === 0 ? 0 : (prev - 1 + results.length) % results.length))
  }

  const handleNextResult = () => {
    setCurrentResultIndex((prev) => (results.length === 0 ? 0 : (prev + 1) % results.length))
  }

  return (
    <BrowserRouter>
      <div className="shell">
        <header className="topbar">
          <Link to="/" className="brand">
            <img src="/logo-mark.svg" alt="" className="brand-mark" />
            <span className="brand-copy">
              <span className="brand-name">REPERTIO</span>
              <span className="brand-tagline">Recomendaciones desde tus playlists</span>
            </span>
          </Link>
          <nav>
            <Link to="/settings" className="settings-link">
              Configuración
            </Link>
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
                selectedIds={selectedIds}
                onToggleSelection={handleToggleSelection}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onGenerate={handleGenerate}
                generationStatus={generationStatus}
                generationError={generationError}
                results={results}
                currentResultIndex={currentResultIndex}
                onPrevResult={handlePrevResult}
                onNextResult={handleNextResult}
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

        <footer className="footer">
          <p className="footer-copy">REPERTIO</p>
          <div className="footer-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
