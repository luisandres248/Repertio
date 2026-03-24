# Repertio

App web (React + Vite + TypeScript) para descubrir artistas nuevos a partir de tus playlists de Spotify, con recomendaciones generadas por Gemini (BYOK).

## Requisitos

- Node.js 20+
- Una app registrada en Spotify Developer

## Configuracion local

1. Copia `.env.example` a `.env`.
2. Completa estas variables:
   - `VITE_SPOTIFY_CLIENT_ID`: client id de tu app de Spotify.
   - `VITE_SPOTIFY_REDIRECT_URI`: URL de callback registrada en Spotify (ejemplo local: `http://localhost:5173/callback`).
3. En Spotify Developer, agrega exactamente la misma redirect URI.

## Instalar y correr

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Seguridad y datos

- No se usa `client_secret` de Spotify en frontend (flujo PKCE).
- La API key de Gemini la ingresa el usuario (BYOK).
- La key de Gemini no se guarda por defecto; opcionalmente puede guardarse en `localStorage`.
- La sesion/token de Spotify se guarda en `sessionStorage`.
