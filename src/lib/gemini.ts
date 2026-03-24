import { z } from 'zod'
import { GEMINI_MODELS } from './config'
import type { GeminiResponse, SeedArtist } from './types'

const recommendedArtistSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  whyFits: z.string().min(1),
  confidence: z.number().min(0).max(1),
})

const groupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  criterion: z.string().min(1),
  rationale: z.string().min(1),
  recommendedArtists: z.array(recommendedArtistSchema).min(3).max(5),
})

const responseSchema = z.object({
  version: z.string().min(1),
  summary: z.string().min(1),
  groups: z.array(groupSchema).min(1),
})

function buildPrompt(seedArtists: SeedArtist[], playlistNames: string[]): string {
  const list = seedArtists.map((a) => `${a.name} (${a.count})`).join(', ')

  return [
    'Analiza este conjunto de playlists y artistas semilla de Spotify y genera recomendaciones de descubrimiento musical.',
    '',
    `Playlists seleccionadas: ${playlistNames.join(', ')}`,
    `Cantidad total de artistas semilla únicos: ${seedArtists.length}`,
    `Artistas semilla (lista completa con frecuencia): ${list}`,
    '',
    'Reglas:',
    '1) Genera 4 grupos distintos.',
    '2) Cada grupo con title, criterion, rationale y recommendedArtists.',
    '3) Cada grupo debe tener entre 3 y 5 artistas recomendados. Minimo 3.',
    '4) Cada artista con name, description, whyFits, confidence.',
    '5) No recomiendes artistas ya presentes en seeds.',
    '6) No repitas artistas entre grupos.',
    '7) Si no estas seguro de un artista, no lo incluyas.',
    '8) Responde SOLO JSON valido para el schema.',
  ].join('\n')
}

function getGenerationConfig() {
  return {
    temperature: 0.7,
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      required: ['version', 'summary', 'groups'],
      properties: {
        version: { type: 'STRING' },
        summary: { type: 'STRING' },
        groups: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            required: ['id', 'title', 'criterion', 'rationale', 'recommendedArtists'],
            properties: {
              id: { type: 'STRING' },
              title: { type: 'STRING' },
              criterion: { type: 'STRING' },
              rationale: { type: 'STRING' },
              recommendedArtists: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  required: ['name', 'description', 'whyFits', 'confidence'],
                  properties: {
                    name: { type: 'STRING' },
                    description: { type: 'STRING' },
                    whyFits: { type: 'STRING' },
                    confidence: { type: 'NUMBER' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }
}

export async function generateRecommendations(
  apiKey: string,
  seedArtists: SeedArtist[],
  playlistNames: string[],
): Promise<GeminiResponse> {
  const prompt = buildPrompt(seedArtists, playlistNames)

  let lastError: Error | null = null

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              role: 'system',
              parts: [
                {
                  text: 'Eres un curador musical. Responde unicamente JSON valido siguiendo el schema solicitado.',
                },
              ],
            },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: getGenerationConfig(),
          }),
        },
      )

      if (!response.ok) {
        lastError = new Error(`Gemini error ${response.status} (${model})`)
        continue
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        lastError = new Error(`Gemini empty response (${model})`)
        continue
      }

      const parsed = JSON.parse(text)
      return responseSchema.parse(parsed)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown Gemini error')
    }
  }

  throw lastError ?? new Error('Unable to call Gemini')
}
