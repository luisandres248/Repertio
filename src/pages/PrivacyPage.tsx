export function PrivacyPage() {
  return (
    <main className="page legal">
      <h1>Politica de Privacidad</h1>
      <p>Ultima actualizacion: 23 de marzo de 2026.</p>

      <h2>Responsable</h2>
      <p>Repertio es operado por Meriland. Contacto: meriland.app@gmail.com.</p>

      <h2>Que datos procesa la app</h2>
      <p>
        Repertio procesa en tu navegador informacion de playlists y artistas de Spotify que seleccionas para generar
        recomendaciones.
      </p>

      <h2>Uso de API key BYOK de Gemini</h2>
      <p>
        Tu API key de Gemini se usa solo para llamar a Gemini desde tu navegador. No se envia a Meriland ni se almacena
        en servidores de Meriland.
      </p>
      <p>
        Por defecto no se guarda la API key. Solo se guarda localmente en tu navegador si activas la opcion "Recordar en
        este navegador".
      </p>

      <h2>Que se envia a Gemini</h2>
      <p>
        Se envia un resumen textual con playlists seleccionadas y artistas semilla (nombre y frecuencia). Nunca se envian
        tokens de Spotify a Gemini.
      </p>

      <h2>Almacenamiento local</h2>
      <p>
        La app guarda sesion de Spotify y preferencias en storage del navegador para que la experiencia funcione entre
        recargas.
      </p>

      <h2>Comparticion con terceros</h2>
      <p>
        Repertio usa APIs de terceros (Spotify y Google Gemini) para operar. El tratamiento posterior de datos por esos
        servicios se rige por sus propias politicas.
      </p>

      <h2>Cambios</h2>
      <p>Esta politica puede actualizarse. La fecha de actualizacion se publica en esta misma pagina.</p>
    </main>
  )
}
