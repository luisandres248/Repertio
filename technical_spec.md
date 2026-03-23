Nombre de la app
"Repertio" (playlist-based artist discovery)

Objetivo
Aplicación web estática y ligera para descubrir artistas nuevos a partir de una o varias playlists del usuario en Spotify. El flujo principal será: login obligatorio con Spotify, listado de playlists accesibles por el usuario, selección de una o varias playlists, extracción y deduplicación de artistas semilla, un único llamado a Gemini sin búsqueda web y con respuesta JSON estricta, validación posterior de artistas recomendados contra el catálogo de Spotify, eliminación de duplicados ya presentes en las playlists origen, y renderizado de resultados en grupos tipo cards. Spotify recomienda Authorization Code con PKCE para single-page apps y exige OAuth para acceder a playlists del usuario; Gemini permite salida estructurada con JSON Schema y la búsqueda web es una capacidad separada que debe activarse explícitamente, por lo que puede mantenerse desactivada en este proyecto.

Alcance funcional inicial
La aplicación será frontend-only servida estáticamente detrás de Caddy en esta VPS. No habrá backend. El login con Spotify será obligatorio. El usuario podrá ver las playlists a las que tenga acceso a través del endpoint de playlists del usuario actual, que cubre playlists propias o seguidas y requiere al menos playlist-read-private; para incluir colaborativas, se debe solicitar además playlist-read-collaborative. La app no aceptará inicialmente una URL arbitraria como input principal; la entrada principal será el selector de playlists tras autenticación. Para obtener los items de la playlist, Spotify documenta que el endpoint de playlist items es accesible solo para playlists del usuario actual o playlists donde sea colaborador, y puede devolver 403 si el usuario no es owner ni collaborator. Por eso el selector de playlists del usuario es el diseño robusto.

Restricciones y supuestos
La app necesitará una app registrada en Spotify Developer para obtener un client_id; el client_secret no debe exponerse en frontend. PKCE evita la necesidad de exponer el secret en una SPA. La app necesitará BYOK de Gemini mediante una API key del usuario, enviada directamente desde el navegador al endpoint de Gemini. Toda la persistencia será local al navegador en esta primera versión. Spotify también establece una política explícita: el contenido de Spotify no puede usarse para entrenar modelos de ML o IA. Aquí el uso será solo para lectura de metadata, selección y validación de catálogo, no entrenamiento.

Arquitectura de alto nivel
Cliente React + Vite.
Routing mínimo en cliente.
Spotify OAuth PKCE en cliente.
Storage local para tokens efímeros, preferencias y cachés pequeñas.
Llamados directos desde frontend a Spotify Web API y Gemini API.
Servidor Caddy entregando assets estáticos, TLS y opcionalmente headers de seguridad.
No habrá base de datos, backend, colas ni cron jobs en la V1.
Gemini se usará con generateContent y responseMimeType application/json más responseSchema para forzar salida estructurada.

Stack exacto
Frontend:
React 18
Vite
TypeScript
CSS Modules o CSS plano con variables CSS
Estado: Zustand o Context + useReducer; prefiero Zustand por liviano y simple
Data fetching: fetch nativo, sin React Query en V1 para mantener peso bajo
Validación runtime: Zod para parsear y validar la respuesta JSON de Gemini y estructuras derivadas
Build/deploy: npm o pnpm, assets estáticos

Servidor:
Caddy como reverse proxy / static file server
HTTPS con certificados automáticos
Compresión gzip/zstd
Headers de seguridad y caché selectiva

APIs externas:
Spotify Web API
Gemini API

Modelo Gemini V1 (prioridad free tier)
Usar por defecto un modelo económico disponible en free tier dentro de Gemini API.
Preferencia:
gemini-2.5-flash-lite (o su variante preview equivalente disponible al momento del deploy)
fallback: gemini-2.0-flash si el anterior no está habilitado en la cuenta
La selección final se valida en runtime contra los modelos disponibles para la API key del usuario.

Objetivos de UX
Interfaz mínima, limpia, usable en desktop y móvil.
Carga inicial muy ligera.
Sin dashboards pesados.
Toda la app gira alrededor de 4 vistas/estados:

Pantalla de login
Selección de playlists
Pantalla de generación
Pantalla de resultados

Flujo completo

Usuario entra a la app.
Si no hay sesión válida de Spotify, se muestra CTA de login.
Se ejecuta Authorization Code with PKCE.
Tras autenticar, la app obtiene access token y refresh token y los guarda localmente.
Se consulta el listado de playlists accesibles del usuario.
El usuario selecciona una o varias playlists.
La app obtiene los items de cada playlist seleccionada.
Se extraen tracks y luego artistas únicos.
Se construye el payload de entrada para Gemini con la lista completa de artistas únicos y sus frecuencias.
Se envía un único prompt a Gemini, sin grounding web, con schema JSON estricto.
Se recibe la respuesta estructurada.
Por cada artista recomendado, se hace búsqueda en Spotify por nombre.
Se intenta resolver link directo en Spotify de forma simple; si no se puede, se conserva el nombre original y se ofrece link de búsqueda en Spotify.
Se eliminan artistas ya presentes en las playlists de entrada.
Se renderizan N grupos como cards.
El usuario puede iterar luego con futuras acciones, pero eso queda fuera de V1.

Autenticación Spotify
Flujo obligatorio: Authorization Code with PKCE. Spotify lo recomienda explícitamente para mobile apps y single-page web apps, y el flujo implícito está deprecado/migrado a PKCE. Se necesitarán redirect URIs registradas en la app de Spotify. El token exchange y refresh se realizan desde el navegador bajo el flujo PKCE.
Reglas de seguridad y simplicidad en callback:
generar y guardar state aleatorio en sessionStorage antes de redirigir
validar state recibido en callback antes de intercambiar code
si state no coincide, abortar login y limpiar estado temporal
tras token exchange exitoso, limpiar code/state de la URL con history.replaceState
si refresh falla, limpiar sesión y forzar relogin

Scopes mínimos de Spotify
playlist-read-private
playlist-read-collaborative

Racional:
playlist-read-private es requerido por Get Current User’s Playlists para acceder a playlists privadas del usuario.
playlist-read-collaborative es necesario para incluir playlists colaborativas en la lista.

Endpoints Spotify necesarios
GET /me/playlists
Uso: listar playlists del usuario autenticado, propias o seguidas.
Notas: paginado con limit y offset; incluir privadas con playlist-read-private; incluir colaborativas con playlist-read-collaborative.

GET /playlists/{playlist_id}/tracks o equivalente de playlist items
Uso: leer items de la playlist.
Notas: Spotify documenta que este endpoint es accesible solo si el usuario es owner o collaborator de esa playlist; si no, puede devolver 403. Este punto justifica que el input sea selección de playlists accesibles, no una URL cualquiera.

GET /search?q=...&type=artist
Uso: resolver artistas recomendados por Gemini en el catálogo de Spotify.
Notas: también recuerda la política de no usar contenido de Spotify para entrenar ML/IA.

GET /artists/{id}
Uso: enriquecer el artista resuelto con géneros, popularidad, imagen y URL.
Notas: útil para cards y validaciones básicas.

Modelo de datos interno
SpotifySession
accessToken: string
refreshToken: string
expiresAt: number
scopes: string[]
tokenType: string

SpotifyPlaylist
id: string
name: string
ownerName: string
ownerId: string
description: string
public: boolean | null
collaborative: boolean
tracksTotal: number
images: { url: string; width?: number; height?: number }[]
externalUrl: string
snapshotId?: string

PlaylistTrackItem
playlistId: string
trackId: string | null
trackName: string | null
artists: SpotifyArtistRef[]
isLocal: boolean
addedAt?: string
available: boolean

SpotifyArtistRef
id: string | null
name: string
externalUrl?: string

SeedArtist
name: string
spotifyId: string | null
count: number
sourcePlaylists: string[]
externalUrl?: string

GeminiRequestInput
selectedPlaylists: { id: string; name: string }[]
seedArtists: { name: string; spotifyId?: string | null; count: number }[]
constraints: {
groupCountTarget: number
artistsPerGroupTarget: number
excludeSeedArtists: boolean
preferDiversity: boolean
preferUnderground: boolean
}
styleHints?: string[]

GeminiResponse
version: string
summary: string
groups: RecommendationGroup[]

RecommendationGroup
id: string
title: string
criterion: string
rationale: string
recommendedArtists: RecommendedArtist[]

RecommendedArtist
name: string
description: string
whyFits: string
confidence: number
undergroundLevel?: string
geo?: string
era?: string
genres?: string[]

ResolvedRecommendationArtist
inputName: string
normalizedName: string
spotifyArtistId: string | null
spotifyName: string | null
spotifyUrl: string | null
imageUrl: string | null
genres: string[]
popularity: number | null
isDuplicateSeedArtist: boolean
resolutionStatus: "matched" | "ambiguous" | "not_found" | "filtered_duplicate"
matchScore: number

RecommendationGroupResolved
id: string
title: string
criterion: string
rationale: string
artists: ResolvedRecommendationArtist[]

Lógica funcional detallada

Login
La pantalla inicial solo muestra branding mínimo, botón Connect Spotify y un acceso a configuración opcional para la API key de Gemini.
Al hacer click en login:
se genera code_verifier
se deriva code_challenge
se redirige a Spotify Accounts authorize con response_type=code, client_id, redirect_uri, scope, code_challenge_method=S256 y code_challenge
al volver con code:
se intercambia por token y refresh token
se guarda sesión
Carga de playlists
Tras login, se llama a /me/playlists en loop de paginación.
Se guarda una lista resumida.
Se renderiza un selector con:
checkbox por playlist
nombre
owner
cantidad de tracks
badge private/collaborative/public
búsqueda por texto
orden por nombre, tamaño o reciente si se quiere en V2
Selección
El usuario puede seleccionar una o varias playlists.
Se establece un límite razonable inicial, por ejemplo hasta 5 playlists o hasta 2000 tracks combinados, para evitar prompts enormes y demasiadas llamadas.
Ingesta de tracks
Por cada playlist seleccionada:
se piden items paginados
se descartan tracks nulos o locales si no tienen metadata útil
se extraen artistas de cada track
se agregan contadores por artista
Construcción de semillas
Se genera un set de artistas únicos.
Se normalizan nombres para comparación:
lowercase
trim
remoción de espacios repetidos
unicode normalize
sin tocar nombres visibles al usuario
Se conserva la frecuencia por aparición en tracks, lo cual puede usarse para dar mayor peso en el prompt.
Perfil resumido para Gemini
En V1 se prioriza simplicidad: enviar la lista completa de artistas semilla únicos y su frecuencia.
Incluir:
conteo total de artistas únicos
nombres de playlists seleccionadas
lista completa de seedArtists con name + count (y spotifyId si existe)
instrucciones explícitas sobre exclusión de duplicados y necesidad de grupos distintos
Si en el futuro el tamaño creciera demasiado, se podrá reintroducir compresión en V2.
Llamado a Gemini
Un solo generateContent.
Sin herramienta de google_search.
Con responseMimeType application/json y responseSchema.
Temperatura moderada, por ejemplo 0.7.
Se pide explícitamente:
N grupos
cada grupo con título, criterio, rationale y artistas
cada artista con descripción corta y razón de ajuste
no repetir artistas entre grupos
no sugerir artistas ya presentes en seeds
priorizar descubrimiento real, no solo ultra-mainstream
si no está seguro de un artista, no inventar
Gemini soporta responseSchema en generateContent; la búsqueda con Google Search es una herramienta aparte que no hace falta activar en este flujo.
Validación y resolución contra Spotify
Por cada recommended artist:
buscar con Search type=artist
si hay resultados, usar el primero como link directo simple para V1
si no hay resultados, marcar not_found pero mantener artista en UI
si hay dudas de desambiguación, marcar ambiguous pero mantener artista en UI
si el spotifyArtistId o nombre resuelto coincide con un artista seed, marcar filtered_duplicate y excluir de UI final
si quieres más calidad, llamar a Get Artist solo para los que pasan filtro
Render final
Se renderiza un card por grupo.
Cada card incluye:
título del grupo
criterio
rationale breve
lista de artistas resueltos
cada artista muestra:
nombre
descripción
whyFits
chips simples de género o era si existen
link a Spotify
estado si hubo resolución parcial
Estados de error
Spotify auth failed
Spotify token expired and refresh failed
No playlists found
No tracks found in selected playlists
Gemini key missing
Gemini invalid JSON
Gemini returned schema-invalid response
No valid artist recommendations after filtering
Rate limited by Spotify or Gemini

Especificación del prompt a Gemini
System instruction
Eres un curador musical especializado en descubrimiento de artistas. Debes analizar una lista de artistas semilla y producir recomendaciones de artistas nuevos, agrupadas en varios conjuntos distintos. No debes repetir artistas entre grupos. No debes recomendar artistas ya presentes en la entrada. Debes priorizar recomendaciones plausibles, útiles y con orientación de descubrimiento, evitando caer siempre en los nombres más obvios y mainstream. Tu salida debe cumplir estrictamente el schema JSON requerido. No agregues texto fuera del JSON.

User prompt template
Analiza este conjunto de playlists y artistas semilla de Spotify y genera recomendaciones de descubrimiento musical.

Contexto:

Playlists seleccionadas: {playlistNames}
Cantidad total de artistas semilla únicos: {seedArtistCount}
Artistas semilla (lista completa con frecuencia): {allSeedArtistsWithCount}

Objetivo:
Genera {groupCount} grupos distintos de descubrimiento. Cada grupo debe tener una lógica clara y distinta. Ejemplos de criterios posibles: geografía, época, sonido, género, movimiento, influencias, cercanía estilística, conexiones históricas, uso en medios, escenas locales, ramas más underground, ramas más experimentales, ramas más melódicas, etc.

Reglas:

No recomiendes artistas que ya estén en la lista de artistas semilla.
No repitas artistas entre grupos.
Evita respuestas vagas o genéricas.
Incluye artistas razonablemente descubribles en Spotify.
Para cada grupo, da un título claro, el criterio y una rationale corta.
Para cada artista, da una descripción corta y explica por qué encaja.
Mezcla recomendaciones cercanas y algunas menos obvias.
Al menos {minPerGroup} artistas por grupo.
Si algún artista te genera duda fuerte, no lo incluyas.

Schema JSON de Gemini
Root object:
version: string
summary: string
groups: array of RecommendationGroup

RecommendationGroup:
id: string
title: string
criterion: string
rationale: string
recommendedArtists: array of RecommendedArtist

RecommendedArtist:
name: string
description: string
whyFits: string
confidence: number 0..1
undergroundLevel: enum ["low","medium","high"] opcional
geo: string opcional
era: string opcional
genres: string[] opcional

Ejemplo operativo de parámetros
groupCount por defecto: 4
artistsPerGroupTarget por defecto: 6
allSeedArtistsWithCount: lista completa de artistas únicos con count

Validación de schema en frontend
Usar Zod con:
chequeo de root object
groups array no vacío
recommendedArtists no vacío por grupo
confidence entre 0 y 1
title/criterion/rationale no vacíos
name no vacío
Luego pasar por postprocesado:
dedup intra-grupo por nombre normalizado
dedup inter-grupo por nombre normalizado
filtrado de seeds

Diseño de resolución de artistas en Spotify
Algoritmo sugerido:
input: nombre recomendado por Gemini
normalizar input
llamar /search?q=artist:{name}&type=artist&limit=5
si hay resultados, tomar el primero como match simple para link directo
si no hay resultados, mantener artista sin link directo
si hay resultados no confiables para desambiguar, marcar ambiguous
luego comparar contra seeds por spotifyArtistId o nombre normalizado
si coincide, filtered_duplicate
si no hay match directo, construir link de búsqueda manual:
https://open.spotify.com/search/{urlEncodedArtistName}

Caching
Todo en frontend.
sessionStorage:
spotify_access_token
spotify_expires_at
spotify_refresh_token
pkce_verifier
oauth_state
app_theme
gemini_api_key opcionalmente no almacenar salvo que el usuario lo permita
localStorage:
theme
última selección de playlists
cache ligera de playlists y resultados por sesión
TTL:
playlists 10 minutos
tracks por playlist 10 minutos
resolved artists 24 horas
No almacenar resultados muy grandes indefinidamente.

Seguridad
El mayor riesgo en una app frontend-only es el manejo de tokens y API keys.
Recomendación:
Spotify tokens en sessionStorage, no localStorage.
Gemini API key no persistir por defecto. Usar un campo tipo password y opción explícita “recordar en este navegador”.
CSP estricta desde Caddy.
No inline scripts.
Referrer-Policy strict-origin-when-cross-origin.
X-Content-Type-Options nosniff.
Permissions-Policy restrictiva.
No exponer logs con tokens.
Limitar analytics externos o no usar ninguno.

Headers sugeridos en Caddy
Content-Security-Policy:
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
connect-src 'self' https://api.spotify.com
 https://accounts.spotify.com
 https://generativelanguage.googleapis.com
;
font-src 'self';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';

Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Permissions-Policy: geolocation=(), microphone=(), camera=()

Caddy deployment
Supuesto:
dominio propio apuntando a la VPS
Caddy sirviendo build estático de Vite

Estructura sugerida en VPS
/var/www/playlist-discovery/dist
/etc/caddy/Caddyfile

Ejemplo conceptual de vhost
playlist.tudominio.com {
root * /var/www/playlist-discovery/dist
encode zstd gzip
file_server
header {
Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.spotify.com
 https://accounts.spotify.com
 https://generativelanguage.googleapis.com
; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
Referrer-Policy "strict-origin-when-cross-origin"
X-Content-Type-Options "nosniff"
X-Frame-Options "DENY"
Permissions-Policy "geolocation=(), microphone=(), camera=()"
}
try_files {path} /index.html
}

Notas:
try_files es necesario para SPA routing.
Configurar redirect URI de Spotify exactamente con tu dominio final y path de callback.
TLS lo gestiona Caddy automáticamente si el DNS está bien.

Estructura de proyecto sugerida
src/
app/
App.tsx
router.tsx
providers.tsx
pages/
LoginPage.tsx
SelectPlaylistsPage.tsx
GeneratePage.tsx
ResultsPage.tsx
SettingsPage.tsx
components/
Layout/
Button/
Card/
Checkbox/
Input/
PlaylistList/
PlaylistRow/
RecommendationGroupCard/
ArtistRecommendationCard/
ThemeToggle/
EmptyState/
LoadingState/
ErrorState/
features/
auth/
spotifyAuth.ts
pkce.ts
authStore.ts
playlists/
spotifyPlaylistsApi.ts
playlistsStore.ts
playlistSelectors.ts
seeds/
extractSeedArtists.ts
normalizeArtist.ts
summarizeSeeds.ts
recommendations/
geminiClient.ts
geminiSchema.ts
recommendationsStore.ts
resolveArtists.ts
dedupeRecommendations.ts
settings/
settingsStore.ts
lib/
fetchJson.ts
storage.ts
zod.ts
env.ts
logger.ts
styles/
tokens.css
globals.css
themes.css
types/
spotify.ts
gemini.ts
app.ts

Rutas sugeridas
/
Si no autenticado, LoginPage
Si autenticado y sin selección, SelectPlaylistsPage
/generate
Vista transitoria de carga y progreso
/results
Resultados de Gemini + resolución Spotify
/settings
Gemini API key, preferencias, tema

Estado global sugerido
authStore
session
loginStatus
error

playlistsStore
allPlaylists
selectedPlaylistIds
loading
error

recommendationsStore
seedArtists
geminiRequest
geminiResponse
resolvedGroups
status
error

settingsStore
theme
geminiApiKey
rememberGeminiKey
groupCount
artistsPerGroup
preferUnderground
preferDiversity

Tema visual
Minimalista, ligero, contraste correcto, sin sombras pesadas.
Usar CSS variables para tema.
Tokens principales:
--bg
--bg-elevated
--text
--text-muted
--border
--accent
--accent-contrast
--success
--warning
--danger

Modo light:
fondo blanco o casi blanco
texto casi negro
bordes grises suaves

Modo dark:
fondo muy oscuro
texto casi blanco
bordes grises medios

Componentes visuales mínimos
Top bar con nombre app, estado de login, theme toggle, settings
Lista de playlists con checkboxes
CTA Generate recommendations
Results con grid de cards responsivo
Cada group card:
título
criterio
rationale
lista de artistas

Mecánica de progreso
En generate:
Paso 1/4 cargando playlists seleccionadas
Paso 2/4 extrayendo artistas
Paso 3/4 consultando Gemini
Paso 4/4 validando en Spotify
Sin barras complejas; solo texto y spinner simple.

Rendimiento
Objetivo bundle JS inicial por debajo de 200 KB gzipped si es posible.
No usar librerías pesadas de UI.
No usar icon packs masivos.
No usar state managers innecesarios.
No usar imágenes salvo artwork de playlist/artist traído desde Spotify.
Paginación y carga incremental para playlists si el usuario tiene muchas.
Evitar llamadas a /artists/{id} si no son necesarias; solo para artistas finalmente mostrados.
Debounce en búsqueda local de playlists.
AbortController para cancelar llamadas cuando cambia la selección.

Límites operativos sugeridos en V1
Máximo 5 playlists seleccionadas
Máximo 2000 tracks combinados procesados
Sin límite específico de seed artists enviados a Gemini en V1 (se envía lista completa de artistas únicos)
Máximo 4 grupos
Máximo 6 artistas por grupo
Eso mantiene costo y latencia razonables.

Gestión de errores y fallback
Caso: Gemini devuelve JSON inválido
acción: intentar parsear texto y extraer bloque JSON si existiera; si no, mostrar error y opción retry

Caso: Gemini devuelve artistas no encontrados
acción: filtrar silenciosamente y mostrar badge “algunas sugerencias no pudieron resolverse en Spotify”

Caso: un grupo queda vacío tras filtros
acción: ocultar grupo o mostrarlo como incompleto según cantidad restante; prefiero ocultarlo si tiene menos de 2 artistas válidos

Caso: Spotify rate limit
acción: mostrar error claro y botón de retry manual; sin retry automático en V1

Caso: token expirado
acción: refresh automático; si falla, forzar relogin

Observabilidad
En V1 solo logging en consola y un modo debug opcional.
No enviar telemetry externa inicialmente.
Un panel debug opcional en settings puede mostrar:
cantidad de playlists
cantidad de tracks
cantidad de artistas únicos
payload resumido enviado a Gemini
artistas filtrados por duplicado
artistas no resueltos

Testing
Unit tests:
normalizeArtist
extractSeedArtists
summarizeSeeds
dedupeRecommendations
resolveArtists básico (match directo, ambiguous, not_found y link de búsqueda)

Integration tests:
auth callback parser
playlist pagination
gemini schema parsing
end-to-end local con mocks de Spotify y Gemini

E2E:
flujo login mockeado
selección de playlists
generación
render de resultados

Datos enviados a Gemini
Enviar solo metadata textual mínima:
nombres de playlists
nombres de artistas semilla
frecuencias
opcionalmente nombres de géneros si luego los obtienes, aunque no es imprescindible en V1
Enviar lista completa de artistas únicos con frecuencia en V1 (sin compresión avanzada).

Privacidad
La app procesa playlists seleccionadas del usuario en navegador.
La API key de Gemini pertenece al usuario y se usa directamente desde su navegador.
No habrá backend propio almacenando playlists ni resultados.
Debe explicitarse al usuario que, al generar recomendaciones, se envía a Gemini un resumen textual de los artistas semilla y nombres de playlists seleccionadas.
No se enviarán tokens Spotify a Gemini en ningún caso.
Mostrar aviso claro al cargar BYOK:
la key se usa solo para llamar a Gemini
la key no se comparte con terceros
la key no se guarda por defecto
si el usuario activa "recordar", se guarda solo en este navegador
Agregar páginas públicas en la app:
/privacy (Política de Privacidad)
/terms (Términos y Condiciones)
Contenido estándar adaptado a este producto, explícito sobre BYOK, datos procesados localmente y límites de responsabilidad.

Plan de implementación por fases

Fase 1
Setup React + Vite + TypeScript
tema light/dark
routing básico
layout mínimo

Fase 2
Spotify PKCE completo
persistencia de sesión
refresh token
logout

Fase 3
listado de playlists
selección múltiple
lectura de items
extracción de artistas únicos

Fase 4
Gemini BYOK
schema JSON
prompt fijo
parseo y validación

Fase 5
búsqueda y resolución de artistas en Spotify
filtro de duplicados
UI de resultados

Fase 6
refinamientos
caché
mejora de scoring
debug panel
error handling

Decisiones de diseño recomendadas
No usar URL de playlist como input principal.
No usar backend en V1.
No usar búsqueda web de Gemini.
No usar demasiados parámetros de personalización en V1; solo generar.
No intentar crear playlists de salida en Spotify todavía.
No usar imágenes obligatorias en cada card si quieres máxima ligereza.

Riesgos principales

Restricción del endpoint de playlist items para playlists no propias/no colaborativas. Ya mitigado con login obligatorio + selector desde /me/playlists.
Hallucinaciones o nombres imprecisos de Gemini. Mitigado con responseSchema + validación + resolución Spotify.
Manejo inseguro de tokens/API keys en frontend. Mitigado con PKCE, sessionStorage y CSP.
Coste o latencia de Gemini si la lista completa de seeds crece mucho. Mitigado en V1 con límites de playlists/tracks y se revisa compresión en V2 si fuera necesario.
Bundle demasiado grande. Mitigado con stack mínimo.

Criterios de aceptación V1
El usuario puede loguearse con Spotify desde la SPA usando PKCE.
La app lista correctamente sus playlists accesibles.
El usuario puede seleccionar múltiples playlists.
La app extrae artistas únicos de las playlists seleccionadas.
La app ejecuta un solo llamado a Gemini sin búsqueda web y obtiene JSON válido según schema.
La app valida y resuelve los artistas recomendados en Spotify.
La app no muestra artistas ya presentes en las playlists origen.
La app renderiza N grupos en cards con título, criterio, rationale y artistas.
Si un artista no tiene match directo, la app igual lo muestra y ofrece link de búsqueda en Spotify.
La app soporta light y dark mode.
La app incluye página /privacy y /terms accesibles desde login/settings/footer.
La UI de BYOK muestra aviso de privacidad y almacenamiento antes de guardar la key.
La app despliega correctamente como sitio estático detrás de Caddy en la VPS.

Configuración necesaria externa
Spotify Developer App:
client_id
redirect_uri de producción
scopes playlist-read-private playlist-read-collaborative

Entorno:
Un único entorno (producción en esta VPS). Sin separación dev/staging/prod en V1.

Gemini:
API key BYOK del usuario
uso de generateContent
responseMimeType application/json
responseSchema definido
modelo recomendado free tier (preferencia): gemini-2.5-flash-lite

Caddy:
dominio
TLS
headers
SPA fallback
