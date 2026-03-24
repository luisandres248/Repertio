# REPERTIO

REPERTIO es una aplicación web estática para descubrir artistas nuevos a partir de playlists de Spotify. El usuario inicia sesión con Spotify, selecciona playlists accesibles, la app extrae artistas semilla desde esas playlists y genera grupos de recomendaciones usando Gemini con BYOK.

## Qué hace

- Autenticación con Spotify mediante Authorization Code + PKCE.
- Lectura de playlists del usuario y selección de hasta 5 playlists.
- Extracción de artistas semilla desde los items de cada playlist.
- Generación de recomendaciones agrupadas con Gemini.
- Resolución de artistas recomendados contra Spotify para obtener enlaces e imágenes.
- Interfaz frontend-only, sin backend propio.

## Stack

- React 19
- Vite
- TypeScript
- React Router
- Zod
- Spotify Web API
- Gemini API

## Arquitectura

La app corre completamente en el navegador y se sirve como sitio estático. Spotify se usa para login, lectura de playlists y enriquecimiento de artistas. Gemini se usa para generar recomendaciones estructuradas a partir de los artistas detectados en las playlists seleccionadas.

No hay servidor de aplicación ni base de datos. Los datos de sesión de Spotify se guardan en `sessionStorage` y la Gemini API key se guarda localmente en el navegador cuando el usuario la decide guardar.

## Integraciones

### Spotify

Se usa para:

- login OAuth con PKCE
- listar playlists
- leer items de playlists
- buscar artistas
- obtener metadata adicional de artistas

### Gemini

Se usa con una API key provista por el usuario para generar recomendaciones agrupadas en formato JSON estricto.

## Estado funcional

La app ya cubre el flujo principal de extremo a extremo:

1. Login con Spotify.
2. Selección de playlists.
3. Generación de recomendaciones.
4. Navegación de grupos recomendados.
5. Apertura de artistas en Spotify.

## Notas

- La app está pensada para ser desplegada como frontend estático.
- No se usa `client_secret` de Spotify en el frontend.
- La Gemini API key no se envía a ningún servidor propio.
