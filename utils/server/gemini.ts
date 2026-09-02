import "server-only"
import { GoogleGenAI, type Part } from "@google/genai"

import type { TAspectRatio } from "@utils/brief/schema"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
// NOTE: gemini-2.5-flash-image accepts reference images alongside the prompt and returns an image
// ↪ HOWEVER: GEMINI_IMAGE_MODEL can point at a newer image model with the same contract
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image"

let client: GoogleGenAI | null = null

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.", 503)
  }
  if (!client) client = new GoogleGenAI({ apiKey })
  return client
}

// NOTE: The SDK surfaces API errors as a JSON string: {"error":{"code":429,"message":"..."}}
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const raw = err.message.trim()
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as {
        error?: { message?: string; code?: number }
      }
      const message = parsed.error?.message
      if (message) {
        const code = parsed.error?.code
        const quotaHint =
          code === 429 && /free_tier|quota/i.test(message)
            ? " Image generation needs a Gemini API project with billing enabled; see https://ai.google.dev/gemini-api/docs/rate-limits."
            : ""
        return `${message.split("\n")[0].trim()}${quotaHint}`
      }
    } catch {
      return raw.replace(/\s+/g, " ").slice(0, 600)
    }
  }
  return raw.replace(/\s+/g, " ").slice(0, 600)
}

function statusFromError(err: unknown): number {
  const maybe = err as { status?: number; code?: number } | undefined
  const status = maybe?.status ?? maybe?.code
  if (typeof status === "number" && status >= 400 && status < 600) return status
  return 502
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export class GeminiError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

export function imageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL
}

function imageSize(): string | undefined {
  const raw = process.env.GEMINI_IMAGE_SIZE?.trim().toUpperCase()
  return raw && /^[124]K$/.test(raw) ? raw : undefined
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

export async function generateCampaignImage(input: IGenerateImageInput): Promise<IGeneratedImage> {
  const ai = getClient()
  const model = imageModel()

  const parts: Part[] = [{ text: input.prompt }]
  input.references.forEach((ref, i) => {
    parts.push({ text: `Image ${i + 1}: ${ref.label}` })
    parts.push({
      inlineData: { mimeType: ref.mimeType, data: ref.data.toString("base64") },
    })
  })

  let response: Awaited<ReturnType<typeof ai.models.generateContent>>
  try {
    response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        // NOTE: GEMINI_IMAGE_SIZE (1K, 2K, 4K) is passed only when set; not every image model accepts it
        imageConfig: { aspectRatio: input.aspectRatio, ...(imageSize() ? { imageSize: imageSize() } : {}) },
        abortSignal: input.signal,
      },
    })
  } catch (err) {
    throw new GeminiError(describeError(err), statusFromError(err))
  }

  const candidate = response.candidates?.[0]
  const outParts = candidate?.content?.parts ?? []
  const image = outParts.find((p) => p.inlineData?.data)
  const text =
    outParts
      .map((p) => p.text)
      .filter(Boolean)
      .join("\n")
      .trim() || null

  if (!image?.inlineData?.data) {
    const reason =
      candidate?.finishReason && candidate.finishReason !== "STOP"
        ? `finish reason ${candidate.finishReason}`
        : response.promptFeedback?.blockReason
          ? `blocked: ${response.promptFeedback.blockReason}`
          : "no image in response"
    throw new GeminiError(`Gemini returned no image (${reason}).${text ? ` Model said: ${text}` : ""}`, 502)
  }

  return {
    mimeType: image.inlineData.mimeType ?? "image/png",
    data: Buffer.from(image.inlineData.data, "base64"),
    text,
    model,
  }
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface IReferenceImage {
  label: string
  mimeType: string
  data: Buffer
}

interface IGenerateImageInput {
  prompt: string
  aspectRatio: TAspectRatio
  references: IReferenceImage[]
  signal?: AbortSignal
}

interface IGeneratedImage {
  mimeType: string
  data: Buffer
  text: string | null
  model: string
}
