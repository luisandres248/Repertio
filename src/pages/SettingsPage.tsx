type SettingsPageProps = {
  apiKey: string
  rememberApiKey: boolean
  onApiKeyChange: (value: string) => void
  onRememberChange: (value: boolean) => void
  onSave: () => void
}

export function SettingsPage({
  apiKey,
  rememberApiKey,
  onApiKeyChange,
  onRememberChange,
  onSave,
}: SettingsPageProps) {
  return (
    <main className="page">
      <h1>Settings</h1>
      <p>Configura tu API key de Gemini (BYOK).</p>

      <section className="panel">
        <h2>Gemini API key</h2>
        <label className="field" htmlFor="gemini-key">
          API key
        </label>
        <input
          id="gemini-key"
          className="input"
          type="password"
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          placeholder="AIza..."
        />

        <label className="checkbox">
          <input
            type="checkbox"
            checked={rememberApiKey}
            onChange={(event) => onRememberChange(event.target.checked)}
          />
          Recordar en este navegador
        </label>

        <button className="button" onClick={onSave}>
          Guardar configuracion
        </button>
      </section>

      <section className="panel">
        <h2>Aviso de privacidad BYOK</h2>
        <ul>
          <li>La key se usa solo para llamar a Gemini desde tu navegador.</li>
          <li>La key no se envia a servidores de Meriland.</li>
          <li>La key no se guarda por defecto.</li>
          <li>Si activas "Recordar", se guarda solo localmente en este navegador.</li>
          <li>Los tokens de Spotify nunca se envian a Gemini.</li>
        </ul>
      </section>
    </main>
  )
}
