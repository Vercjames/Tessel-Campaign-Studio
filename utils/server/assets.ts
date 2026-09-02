import "server-only"
import { createHash } from "node:crypto"
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import { ASSET_NAME_PATTERN } from "@utils/brief/schema"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
// NOTE: The repo folder is read-only on Vercel, so the library moves to /tmp there and is seeded from the bundle
// ↪ HOWEVER: /tmp is per instance and wiped on cold start, so uploads on Vercel do not persist
const BUNDLED_ASSETS_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "assets")
const DEFAULT_ASSETS_DIR = process.env.VERCEL ? "/tmp/tessel/assets" : "assets"
export const ASSETS_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.ASSETS_DIR ?? DEFAULT_ASSETS_DIR)

let seeded: Promise<void> | null = null

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
}

const MAX_ASSET_BYTES = 20 * 1024 * 1024

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function assetPath(name: string): string {
  if (!isValidAssetName(name)) throw new AssetError(`Invalid asset name "${name}"`, 400)
  const full = path.resolve(ASSETS_DIR, name)
  if (path.dirname(full) !== ASSETS_DIR) throw new AssetError(`Invalid asset name "${name}"`, 400)
  return full
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export class AssetError extends Error {
  status: number
  constructor(message: string, status = 404) {
    super(message)
    this.status = status
  }
}

function mimeForName(name: string): string | null {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] ?? null
}

function isValidAssetName(name: string): boolean {
  return ASSET_NAME_PATTERN.test(name) && !name.includes("/") && !name.includes("\\")
}

// NOTE: Bundled assets are copied into a writable library once per process; existing files are never overwritten
async function seedAssetsDir(): Promise<void> {
  await mkdir(ASSETS_DIR, { recursive: true })
  if (ASSETS_DIR === BUNDLED_ASSETS_DIR) return
  let entries: string[] = []
  try {
    entries = await readdir(BUNDLED_ASSETS_DIR)
  } catch {
    return
  }
  for (const name of entries) {
    if (!mimeForName(name) || !isValidAssetName(name)) continue
    const target = path.join(ASSETS_DIR, name)
    try {
      await stat(target)
    } catch {
      await copyFile(path.join(BUNDLED_ASSETS_DIR, name), target)
    }
  }
}

async function ensureAssetsDir(): Promise<void> {
  if (!seeded)
    seeded = seedAssetsDir().catch((err) => {
      seeded = null
      throw err
    })
  await seeded
}

export async function listAssets(): Promise<IAssetInfo[]> {
  await ensureAssetsDir()
  const entries = await readdir(ASSETS_DIR, { withFileTypes: true })
  const infos: IAssetInfo[] = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const mimeType = mimeForName(entry.name)
    if (!mimeType || !isValidAssetName(entry.name)) continue
    const s = await stat(path.join(ASSETS_DIR, entry.name))
    infos.push({
      name: entry.name,
      mimeType,
      size: s.size,
      modifiedAt: s.mtime.toISOString(),
    })
  }
  return infos.sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadAsset(name: string): Promise<ILoadedAsset> {
  await ensureAssetsDir()
  const full = assetPath(name)
  let data: Buffer
  try {
    data = await readFile(full)
  } catch {
    throw new AssetError(`Asset "${name}" not found in the asset library`, 404)
  }
  const s = await stat(full)
  const mimeType = mimeForName(name)
  if (!mimeType) throw new AssetError(`Unsupported asset type "${name}"`, 400)
  return {
    name,
    mimeType,
    size: s.size,
    modifiedAt: s.mtime.toISOString(),
    data,
    sha256: createHash("sha256").update(data).digest("hex"),
  }
}

// NOTE: Same name and same bytes is a no-op
export async function saveAsset(name: string, data: Buffer): Promise<{ asset: IAssetInfo; reused: boolean }> {
  await ensureAssetsDir()
  const full = assetPath(name)
  const mimeType = mimeForName(name)
  if (!mimeType) throw new AssetError(`Unsupported asset type "${name}"`, 400)
  if (data.byteLength === 0) throw new AssetError("Empty file", 400)
  if (data.byteLength > MAX_ASSET_BYTES) throw new AssetError("Asset larger than 20 MB", 413)

  let reused = false
  try {
    const existing = await readFile(full)
    reused = existing.equals(data)
  } catch {
    reused = false
  }
  if (!reused) await writeFile(full, data)
  const s = await stat(full)
  return {
    reused,
    asset: { name, mimeType, size: s.size, modifiedAt: s.mtime.toISOString() },
  }
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
export interface IAssetInfo {
  name: string
  mimeType: string
  size: number
  modifiedAt: string
}

export interface ILoadedAsset extends IAssetInfo {
  data: Buffer
  sha256: string
}
