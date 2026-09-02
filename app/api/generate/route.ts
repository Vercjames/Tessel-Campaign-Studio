import type { IApiError, IGenerateResponse, TApiErrorCode } from "@utils/api-types"
import { assetsForBrief, jobId as buildJobId, campaignSlug, masterVariant } from "@utils/brief/jobs"
import { checkLegal, describeLegalIssues, extraLegalTerms } from "@utils/brief/legal"
import { validateBrief } from "@utils/brief/parse"
import { buildPrompt } from "@utils/brief/prompt"
import { ASPECT_RATIOS } from "@utils/brief/schema"
import { AssetError, type ILoadedAsset, loadAsset } from "@utils/server/assets"
import { overlayLogo } from "@utils/server/compose"
import { GeminiError, generateCampaignImage, imageModel, isTimeout } from "@utils/server/gemini"
import { type IOutputRef, rawOutputPath, readOutput, saveOutput, saveOutputMeta, saveRawOutput } from "@utils/server/outputs"
import { NextResponse } from "next/server"
import sharp from "sharp"
import { z } from "zod"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
export const runtime = "nodejs"

// NOTE: Two Gemini attempts of GEMINI_TIMEOUT_MS each must fit; 300 s is the Vercel ceiling on Hobby and Pro with Fluid compute
export const maxDuration = 300

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
const RequestSchema = z.object({
  brief: z.unknown(),
  locale: z.string().trim().min(2).max(12),
  aspectRatio: z.enum(ASPECT_RATIOS),
  runId: z.string().regex(/^[a-z0-9][a-z0-9-]{3,31}$/),
  masterPath: z.string().max(400).optional(),
})

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function error(message: string, status: number, details?: unknown, code?: TApiErrorCode) {
  return NextResponse.json<IApiError>({ error: message, code, details }, { status })
}

// NOTE: Aspect check with a small tolerance, since the model rounds to its own pixel grid
async function matchesRatio(data: Buffer, aspectRatio: string): Promise<boolean> {
  const [w, h] = aspectRatio.split(":").map(Number)
  const meta = await sharp(data).metadata()
  if (!meta.width || !meta.height) return false
  const actual = meta.width / meta.height
  const wanted = w / h
  return Math.abs(actual - wanted) / wanted <= 0.03
}

// NOTE: Derived jobs read the parent's raw render (before the corner mark) so nothing is stamped twice
async function readParent(relPath: string): Promise<{ data: Buffer; mimeType: string } | null> {
  return (await readOutput(rawOutputPath(relPath).split("/"))) ?? (await readOutput(relPath.split("/")))
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
// NOTE: One request renders the campaign composition in one locale at one aspect ratio
// ↪ CONTEXT: The master is generated; a locale variant is generated against the master; a ratio variant is the
// ↪ HOWEVER: parent's own pixels cropped or extended, so only new bands ever come from the model
export async function POST(req: Request) {
  let body: z.infer<typeof RequestSchema>
  try {
    body = RequestSchema.parse(await req.json())
  } catch (err) {
    return error("Invalid request", 400, err instanceof z.ZodError ? err.issues : String(err))
  }

  let brief: ReturnType<typeof validateBrief>
  try {
    brief = validateBrief(body.brief)
  } catch (err) {
    return error("Invalid campaign brief", 400, err instanceof z.ZodError ? err.issues : String(err))
  }

  // NOTE: Prohibited words anywhere in the brief stop the render before any model call is made
  const legal = checkLegal(brief, extraLegalTerms(process.env.LEGAL_BLOCKLIST))
  if (legal.length > 0) return error(describeLegalIssues(legal), 422, legal, "legal")

  if (!brief.locales.includes(body.locale)) {
    return error(`Locale "${body.locale}" is not in the brief's locales`, 400)
  }
  if (!brief.aspectRatio.includes(body.aspectRatio)) {
    return error(`Aspect ratio "${body.aspectRatio}" is not set on this campaign`, 400)
  }

  const campaignId = campaignSlug(brief)
  const jobId = buildJobId(campaignId, body.locale, body.aspectRatio)
  const master = masterVariant(brief)
  const isMaster = body.locale === master.locale && body.aspectRatio === master.aspectRatio
  const derivation: TDerivation = isMaster ? "master" : body.aspectRatio === master.aspectRatio ? "locale" : "ratio"
  const parentJobId =
    derivation === "master"
      ? null
      : derivation === "locale"
        ? buildJobId(campaignId, master.locale, master.aspectRatio)
        : buildJobId(campaignId, body.locale, master.aspectRatio)

  // NOTE: Missing assets are reported, not fatal
  const loaded: ILoadedAsset[] = []
  const assetsMissing: string[] = []
  for (const name of assetsForBrief(brief)) {
    try {
      loaded.push(await loadAsset(name))
    } catch (err) {
      if (err instanceof AssetError && err.status === 404) assetsMissing.push(name)
      else return error(err instanceof Error ? err.message : String(err), 400)
    }
  }
  const has = (name: string | undefined) => Boolean(name) && loaded.some((a) => a.name === name)

  const effectiveBrief = {
    ...brief,
    brand: brief.brand ? { ...brief.brand, logo: has(brief.brand.logo) ? brief.brand.logo : undefined } : undefined,
    products: brief.products.map((p) => ({ ...p, referenceImages: p.referenceImages?.filter((r) => has(r.file)) })),
  }
  const model = imageModel()

  // NOTE: The corner mark is composited from the file afterwards, not drawn by the model
  const logoAsset = effectiveBrief.brand?.logo ? loaded.find((a) => a.name === effectiveBrief.brand?.logo) : undefined
  const cornerLogo = logoAsset && brief.logoPlacement.includes("corner") ? logoAsset : undefined

  let parent: { relPath: string; mimeType: string; data: Buffer } | null = null
  if (derivation !== "master") {
    const missing = `Generate the parent image (${derivation === "locale" ? master.locale : body.locale}, ${master.aspectRatio}) first`
    if (!body.masterPath) return error(missing, 409)
    const file = await readParent(body.masterPath)
    if (!file) return error(missing, 409)
    parent = { relPath: body.masterPath, mimeType: file.mimeType, data: file.data }
  }

  const location = { campaignId, locale: body.locale, aspectRatio: body.aspectRatio, runId: body.runId }

  const finish = async (
    rawData: Buffer,
    rawMime: string,
    prompt: string,
    headline: string | null,
    assetsUsed: string[],
    note: string | null,
  ) => {
    let mimeType = rawMime
    let data = rawData
    if (cornerLogo) {
      await saveRawOutput(location, rawMime, rawData)
      data = await overlayLogo(rawData, cornerLogo.data, brief.logoPosition)
      mimeType = "image/png"
    }
    const ref: IOutputRef = await saveOutput(location, mimeType, data)
    const meta = {
      jobId,
      runId: body.runId,
      masterJobId: parentJobId,
      campaignId,
      campaignName: brief.name ?? campaignId,
      locale: body.locale,
      aspectRatio: body.aspectRatio,
      model,
      prompt,
      headline,
      assetsUsed: Array.from(new Set([...assetsUsed, ...(cornerLogo ? [cornerLogo.name] : [])])),
      assetsMissing,
      note,
      createdAt: new Date().toISOString(),
    }
    await saveOutputMeta(ref, meta)
    return NextResponse.json<IGenerateResponse>({
      ...meta,
      imageUrl: ref.url,
      imagePath: ref.relPath,
      reviewUrl: ref.reviewUrl,
      mimeType: ref.mimeType,
    })
  }

  try {
    // NOTE: Locale variants keep the master's picture and change the wording; ratio variants re-compose it for the frame
    // ↪ ERGO: Nothing is ever cropped or padded, so no text or product can end up cut off or displaced
    const prompt = buildPrompt(
      effectiveBrief,
      body.locale,
      body.aspectRatio,
      parent
        ? {
            name: parent.relPath,
            locale: master.locale,
            aspectRatio: master.aspectRatio,
            mode: derivation === "locale" ? "locale" : "reframe",
          }
        : undefined,
    )
    const inputs = prompt.references.map((ref) => {
      if (ref.role === "master") {
        if (!parent) throw new Error("master reference without a parent file")
        return {
          name: ref.name,
          label: "master: the approved campaign image",
          mimeType: parent.mimeType,
          data: parent.data,
          library: false,
        }
      }
      const asset = loaded.find((a) => a.name === ref.name)
      if (!asset) throw new Error(`asset ${ref.name} vanished`)
      return { name: asset.name, label: `${ref.role}: ${ref.name}`, mimeType: asset.mimeType, data: asset.data, library: true }
    })
    const generate = () =>
      generateCampaignImage({
        prompt: prompt.text,
        aspectRatio: body.aspectRatio,
        references: inputs.map((i) => ({ label: i.label, mimeType: i.mimeType, data: i.data })),
        signal: req.signal,
      })
    let image = await generate()
    // NOTE: A re-composition that comes back in the master's frame instead of the requested one is retried once
    if (derivation === "ratio" && !(await matchesRatio(image.data, body.aspectRatio))) {
      image = await generate()
      if (!(await matchesRatio(image.data, body.aspectRatio))) {
        throw new GeminiError(`The model returned the wrong frame for ${body.aspectRatio} twice; try again`, 502)
      }
    }
    return finish(
      image.data,
      image.mimeType,
      prompt.text,
      prompt.headline,
      inputs.filter((i) => i.library).map((i) => i.name),
      image.text,
    )
  } catch (err) {
    if (err instanceof GeminiError) {
      if (isTimeout(err)) return error("Gemini timed out before the image was ready. Resubmit to try again.", 504, undefined, "timeout")
      return error(err.message, err.status)
    }
    // NOTE: Logged so hosted runtime logs show the cause, not just the 500
    console.error(`[generate] ${jobId}`, err)
    return error(err instanceof Error ? err.message : "Generation failed", 500)
  }
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
type TDerivation = "master" | "locale" | "ratio"
