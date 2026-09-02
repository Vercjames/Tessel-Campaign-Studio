import "server-only"
import path from "node:path"
import { type IStorage, storageFor } from "@utils/server/storage"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
// NOTE: Files are named by run id so a rerun never overwrites an earlier image
export const OUTPUTS_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.OUTPUTS_DIR ?? "storage/outputs")

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
}

const EXT_BY_MIME_REVERSE: Record<string, string> = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]))

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function store(): IStorage {
  return storageFor(OUTPUTS_DIR, "outputs/")
}

function safeSegment(seg: string): string {
  const clean = seg.replace(/[^a-z0-9-]/gi, "-").toLowerCase()
  if (!clean || clean === "." || clean === "..") throw new Error("Invalid output path segment")
  return clean
}

function baseName(loc: IOutputLocation): string {
  const ratio = loc.aspectRatio.replace(":", "x")
  return `${safeSegment(loc.locale)}__${ratio}__${safeSegment(loc.runId)}`
}

function mimeForExt(ext: string): string {
  return EXT_BY_MIME_REVERSE[ext] ?? "image/png"
}

function encodePath(relPath: string): string {
  return relPath.split("/").map(encodeURIComponent).join("/")
}

function toRef(relPath: string, size: number): IOutputRef {
  return {
    relPath,
    url: `/api/outputs/${encodePath(relPath)}`,
    reviewUrl: `/results/${encodePath(relPath)}`,
    mimeType: mimeForExt(path.extname(relPath).toLowerCase()),
    size,
  }
}

function metaKey(relPath: string): string {
  const ext = path.extname(relPath)
  return `${relPath.slice(0, -ext.length)}.json`
}

// NOTE: Path traversal guard; only image keys directly under a campaign folder are addressable
function imageKey(segments: string[]): string | null {
  if (segments.length !== 2 || segments.some((s) => !s || s === "." || s === ".." || s.includes("\\"))) return null
  const key = segments.join("/")
  return path.extname(key).toLowerCase() in EXT_BY_MIME_REVERSE ? key : null
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export async function saveOutput(loc: IOutputLocation, mimeType: string, data: Buffer): Promise<IOutputRef> {
  const ext = EXT_BY_MIME[mimeType] ?? ".png"
  const key = `${safeSegment(loc.campaignId)}/${baseName(loc)}${ext}`
  await store().write(key, data, mimeType)
  return toRef(key, data.byteLength)
}

// NOTE: The un-composited render is kept beside the final file so derived variants start from a clean master
export function rawOutputPath(relPath: string): string {
  const ext = path.extname(relPath)
  return `${relPath.slice(0, -ext.length)}__raw${ext}`
}

export async function saveRawOutput(loc: IOutputLocation, mimeType: string, data: Buffer): Promise<void> {
  const ext = EXT_BY_MIME[mimeType] ?? ".png"
  await store().write(`${safeSegment(loc.campaignId)}/${baseName(loc)}__raw${ext}`, data, mimeType)
}

export async function readOutput(segments: string[]): Promise<{ data: Buffer; mimeType: string } | null> {
  const key = imageKey(segments)
  if (!key) return null
  const file = await store().read(key)
  return file ? { data: file.data, mimeType: mimeForExt(path.extname(key).toLowerCase()) } : null
}

export async function saveOutputMeta(ref: IOutputRef, meta: Omit<IOutputMeta, "image">): Promise<void> {
  const full: IOutputMeta = { ...meta, image: ref }
  await store().write(metaKey(ref.relPath), Buffer.from(JSON.stringify(full, null, 2)), "application/json")
}

// NOTE: One listing confirms every sidecar's image still exists, so no per-file existence checks
export async function listOutputs(campaignId: string): Promise<IOutputMeta[]> {
  let dirName: string
  try {
    dirName = safeSegment(campaignId)
  } catch {
    return []
  }
  const entries = await store().list(`${dirName}/`)
  const present = new Set(entries.map((e) => e.key))
  const metas: IOutputMeta[] = []
  for (const entry of entries) {
    if (path.extname(entry.key) !== ".json") continue
    try {
      const file = await store().read(entry.key)
      if (!file) continue
      const meta = JSON.parse(file.data.toString("utf8")) as IOutputMeta
      if (!meta?.jobId || !meta.image?.relPath || !present.has(meta.image.relPath)) continue
      metas.push(meta)
    } catch {}
  }
  metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return metas
}

export async function readOutputMeta(segments: string[]): Promise<IOutputMeta | null> {
  const key = imageKey(segments)
  if (!key) return null
  const file = await store().read(metaKey(key))
  if (!file) return null
  try {
    return JSON.parse(file.data.toString("utf8")) as IOutputMeta
  } catch {
    return null
  }
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface IOutputLocation {
  campaignId: string
  locale: string
  aspectRatio: string
  runId: string
}

export interface IOutputRef {
  relPath: string
  url: string
  reviewUrl: string
  mimeType: string
  size: number
}

interface IOutputMeta {
  image: IOutputRef
  jobId: string
  runId: string
  masterJobId: string | null
  campaignId: string
  campaignName: string
  locale: string
  aspectRatio: string
  model: string
  prompt: string
  headline: string | null
  assetsUsed: string[]
  assetsMissing: string[]
  note: string | null
  createdAt: string
}
