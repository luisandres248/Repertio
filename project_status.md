# Project Status - Repertio

Last update: 2026-03-23

## Summary
Se inicializo y dejo funcionando una V1 frontend-only de Repertio con React + Vite + TypeScript, incluyendo:
- Login Spotify via Authorization Code + PKCE.
- Callback OAuth con validacion de `state`.
- Carga de playlists del usuario autenticado.
- Seleccion multiple de playlists (max 5).
- Extraccion de artistas semilla unicos con frecuencia.
- Generacion de recomendaciones via Gemini BYOK (1 llamada, JSON schema estricto).
- Resolucion simple de artistas contra Spotify Search.
- Render de resultados por grupos.
- Settings de BYOK con aviso de privacidad.
- Paginas publicas `/privacy` y `/terms`.

## Technical Spec
Se actualizo `technical_spec.md` con decisiones cerradas:
- Modelo Gemini V1 priorizando free tier (`gemini-2.5-flash-lite`, fallback `gemini-2.0-flash`).
- Simplicidad en retries (manuales, sin backoff automatico V1).
- Envio de lista completa de seed artists con count (sin compactacion avanzada en V1).
- Resolucion simple de artistas y fallback a link de busqueda Spotify.
- Un solo ambiente (esta VPS).
- Requisito explicito de textos/privacy/terms en la app.

## Implemented Files
- `src/App.tsx`: routing + flujo principal completo.
- `src/lib/config.ts`: client_id, redirect_uri, modelos Gemini y storage keys.
- `src/lib/storage.ts`: persistencia session/local storage.
- `src/lib/pkce.ts`: PKCE helpers + normalize.
- `src/lib/spotify.ts`: OAuth PKCE, token exchange/refresh, playlists/tracks/search.
- `src/lib/gemini.ts`: request generateContent + schema + parse Zod.
- `src/lib/types.ts`: tipos de dominio.
- `src/pages/SettingsPage.tsx`: BYOK + aviso privacidad.
- `src/pages/PrivacyPage.tsx`: politica adaptada.
- `src/pages/TermsPage.tsx`: terminos adaptados.
- `src/index.css`: estilos base responsive.

## Validation
- `npm run build` OK.
- `npm run lint` OK.

## Important Configuration
- Spotify client id configurado en codigo:
  - `93d1172ca9ac4996abfe12a336dbb720`
- Redirect URI configurada:
  - `https://repertio.meriland.xyz/callback`

## Pending / Next Steps
1. Confirmar en Spotify Developer que la Redirect URI exacta este registrada (sin typo).
2. Confirmar scopes en Spotify app:
   - `playlist-read-private`
   - `playlist-read-collaborative`
3. Probar flujo real end-to-end en dominio final.
4. Configurar Caddy para servir `dist` con headers y `try_files` SPA fallback.
5. Ajustar textos legales finales si queres version mas formal/juridica.
6. (Opcional) refinamientos V2: scoring de matching, cache mas fina, mejoras UX.

## Notes
- No backend implementado (por diseno V1).
- BYOK no se guarda por defecto; solo si el usuario activa recordatorio.
- Si Spotify refresh falla, la sesion se limpia y se requiere relogin.
