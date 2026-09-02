import "server-only"
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
// NOTE: Files are named by run id so a rerun never overwrites an earlier image
// ↪ HOWEVER: On Vercel the only writable path is /tmp, which is per instance and wiped on cold start
const DEFAULT_OUTPUTS_DIR = process.env.VERCEL ? "/tmp/tessel/outputs" : "storage/outputs"
export const OUTPUTS_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.OUTPUTS_DIR ?? DEFAULT_OUTPUTS_DIR)

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
}

const EXT_BY_MIME_REVERSE: Record<string, string> = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]))

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
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

function metaPath(relPath: string): string {
  const ext = path.extname(relPath)
  return path.join(OUTPUTS_DIR, `${relPath.slice(0, -ext.length)}.json`)
}

// NOTE: Path traversal guard
function resolveInside(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((s) => !s || s === "." || s === "..")) return null
  const full = path.resolve(OUTPUTS_DIR, ...segments)
  return full.startsWith(`${OUTPUTS_DIR}${path.sep}`) ? full : null
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export async function saveOutput(loc: IOutputLocation, mimeType: string, data: Buffer): Promise<IOutputRef> {
  const dirName = safeSegment(loc.campaignId)
  const dir = path.join(OUTPUTS_DIR, dirName)
  await mkdir(dir, { recursive: true })
  const ext = EXT_BY_MIME[mimeType] ?? ".png"
  const file = `${baseName(loc)}${ext}`
  await writeFile(path.join(dir, file), data)
  return toRef(`${dirName}/${file}`, data.byteLength)
}

// NOTE: The un-composited render is kept beside the final file so derived variants start from a clean master
export function rawOutputPath(relPath: string): string {
  const ext = path.extname(relPath)
  return `${relPath.slice(0, -ext.length)}__raw${ext}`
}

export async function saveRawOutput(loc: IOutputLocation, mimeType: string, data: Buffer): Promise<void> {
  const dirName = safeSegment(loc.campaignId)
  await mkdir(path.join(OUTPUTS_DIR, dirName), { recursive: true })
  const ext = EXT_BY_MIME[mimeType] ?? ".png"
  await writeFile(path.join(OUTPUTS_DIR, dirName, `${baseName(loc)}__raw${ext}`), data)
}

export async function readOutput(segments: string[]): Promise<{ data: Buffer; mimeType: string } | null> {
  const full = resolveInside(segments)
  if (!full) return null
  const ext = path.extname(full).toLowerCase()
  if (!(ext in EXT_BY_MIME_REVERSE)) return null
  try {
    const data = await readFile(full)
    return { data, mimeType: mimeForExt(ext) }
  } catch {
    return null
  }
}

export async function saveOutputMeta(ref: IOutputRef, meta: Omit<IOutputMeta, "image">): Promise<void> {
  const full: IOutputMeta = { ...meta, image: ref }
  await writeFile(metaPath(ref.relPath), JSON.stringify(full, null, 2))
}

export async function listOutputs(campaignId: string): Promise<IOutputMeta[]> {
  let dirName: string
  try {
    dirName = safeSegment(campaignId)
  } catch {
    return []
  }
  const dir = path.join(OUTPUTS_DIR, dirName)
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }
  const metas: IOutputMeta[] = []
  for (const entry of entries) {
    if (path.extname(entry) !== ".json") continue
    try {
      const meta = JSON.parse(await readFile(path.join(dir, entry), "utf8")) as IOutputMeta
      if (!meta?.jobId || !meta.image?.relPath) continue
      const image = resolveInside(meta.image.relPath.split("/"))
      if (!image) continue
      await stat(image)
      metas.push(meta)
    } catch {}
  }
  metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return metas
}

export async function readOutputMeta(segments: string[]): Promise<IOutputMeta | null> {
  const full = resolveInside(segments)
  if (!full) return null
  const ext = path.extname(full).toLowerCase()
  if (!(ext in EXT_BY_MIME_REVERSE)) return null
  try {
    const raw = await readFile(`${full.slice(0, -ext.length)}.json`, "utf8")
    return JSON.parse(raw) as IOutputMeta
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
