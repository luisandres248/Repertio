type SettingsPageProps = {
  apiKey: string
  notice: string | null
  onApiKeyChange: (value: string) => void
  onSave: () => void
  onClear: () => void
}

export function SettingsPage({
  apiKey,
  notice,
  onApiKeyChange,
  onSave,
  onClear,
}: SettingsPageProps) {
  return (
    <main className="page settings-page">
      <section className="hero-panel">
        <p className="eyebrow">Configuración</p>
        <h1>Gemini BYOK</h1>
        <p className="hero-copy">
          Repertio usa tu propia Gemini API key para generar recomendaciones desde el navegador. No se envía a
          servidores de Meriland y no forma parte del login de Spotify.
        </p>
      </section>

      <section className="settings-layout">
        <section className="panel settings-main">
          <div className="section-heading">
            <h2>Clave local</h2>
            <p>
              La app necesita la key guardada en este navegador para poder ejecutar la búsqueda cuando presionas
              Generar recomendaciones.
            </p>
          </div>

          <form className="settings-form" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
            <label className="field" htmlFor="gemini-key">
              Gemini API key
            </label>
            <input
              id="gemini-key"
              className="input"
              type="password"
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder="AIza..."
              autoComplete="new-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
            />

            <p className="muted">
              Si la guardas, queda disponible solo en este navegador mediante `localStorage`. El botón Limpiar la
              elimina por completo.
            </p>

            <div className="button-row">
              <button className="button" type="button" onClick={onSave}>
                Guardar clave
              </button>
              <button className="button secondary" type="button" onClick={onClear}>
                Limpiar clave
              </button>
            </div>

            {notice ? <p className="notice-banner">{notice}</p> : null}
          </form>
        </section>

        <section className="panel settings-side">
          <div className="section-heading">
            <h2>Como obtenerla</h2>
            <p>La key se genera en Google AI Studio.</p>
          </div>
          <a className="button link-button" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
            Abrir Google AI Studio
          </a>
          <ol className="steps-list">
            <li>Entra a Google AI Studio con tu cuenta.</li>
            <li>Crea una API key nueva para uso personal.</li>
            <li>Copiala y pegala aqui.</li>
            <li>Guarda la key y vuelve a la pantalla principal.</li>
          </ol>
        </section>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Seguridad y alcance</h2>
          <p>El comportamiento actual del producto es este.</p>
        </div>
        <ul className="bullet-grid">
          <li>La Gemini API key se usa solo desde tu navegador para llamar a Gemini.</li>
          <li>La key no se reenvía a ningún backend propio porque la app es estática.</li>
          <li>Los tokens de Spotify no se envían a Gemini.</li>
          <li>Limpiar clave borra la key guardada del navegador actual.</li>
          <li>El campo intenta evitar sugerencias de password managers, aunque eso depende del navegador y sus extensiones.</li>
        </ul>
      </section>
    </main>
  )
}
