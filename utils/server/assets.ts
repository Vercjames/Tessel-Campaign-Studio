import "server-only"
import { createHash } from "node:crypto"
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { ASSET_NAME_PATTERN } from "@utils/brief/schema"
import { type IStorage, type IStoredFile, storageDriver, storageFor } from "@utils/server/storage"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
// NOTE: The repo's assets folder ships with the app and is read-only on Vercel; uploads go to the storage driver
// ↪ ERGO: On disk the two are the same folder, on Blob the bundle is read beside the store
export const ASSETS_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.ASSETS_DIR ?? "assets")

const BUNDLED_ASSETS_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "assets")

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
function store(): IStorage {
  return storageFor(ASSETS_DIR, "assets/")
}

function bundleIsSeparate(): boolean {
  return storageDriver() === "blob" || ASSETS_DIR !== BUNDLED_ASSETS_DIR
}

function mimeForName(name: string): string | null {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] ?? null
}

function isValidAssetName(name: string): boolean {
  return ASSET_NAME_PATTERN.test(name) && !name.includes("/") && !name.includes("\\")
}

function checkName(name: string): void {
  if (!isValidAssetName(name)) throw new AssetError(`Invalid asset name "${name}"`, 400)
}

async function readBundled(name: string): Promise<IStoredFile | null> {
  if (!bundleIsSeparate()) return null
  const full = path.join(BUNDLED_ASSETS_DIR, name)
  try {
    const [data, s] = await Promise.all([readFile(full), stat(full)])
    return { data, contentType: mimeForName(name) ?? "application/octet-stream", size: s.size, modifiedAt: s.mtime.toISOString() }
  } catch {
    return null
  }
}

async function listBundled(): Promise<IAssetInfo[]> {
  if (!bundleIsSeparate()) return []
  let entries: string[]
  try {
    entries = await readdir(BUNDLED_ASSETS_DIR)
  } catch {
    return []
  }
  const infos: IAssetInfo[] = []
  for (const name of entries) {
    const mimeType = mimeForName(name)
    if (!mimeType || !isValidAssetName(name)) continue
    const s = await stat(path.join(BUNDLED_ASSETS_DIR, name))
    infos.push({ name, mimeType, size: s.size, modifiedAt: s.mtime.toISOString() })
  }
  return infos
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

// NOTE: Uploads win over bundled files of the same name
export async function listAssets(): Promise<IAssetInfo[]> {
  const byName = new Map<string, IAssetInfo>()
  for (const info of await listBundled()) byName.set(info.name, info)
  for (const entry of await store().list("")) {
    const mimeType = mimeForName(entry.key)
    if (!mimeType || !isValidAssetName(entry.key)) continue
    byName.set(entry.key, { name: entry.key, mimeType, size: entry.size, modifiedAt: entry.modifiedAt })
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadAsset(name: string): Promise<ILoadedAsset> {
  checkName(name)
  const mimeType = mimeForName(name)
  if (!mimeType) throw new AssetError(`Unsupported asset type "${name}"`, 400)
  const file = (await store().read(name)) ?? (await readBundled(name))
  if (!file) throw new AssetError(`Asset "${name}" not found in the asset library`, 404)
  return {
    name,
    mimeType,
    size: file.size,
    modifiedAt: file.modifiedAt,
    data: file.data,
    sha256: createHash("sha256").update(file.data).digest("hex"),
  }
}

// NOTE: Same name and same bytes is a no-op
export async function saveAsset(name: string, data: Buffer): Promise<{ asset: IAssetInfo; reused: boolean }> {
  checkName(name)
  const mimeType = mimeForName(name)
  if (!mimeType) throw new AssetError(`Unsupported asset type "${name}"`, 400)
  if (data.byteLength === 0) throw new AssetError("Empty file", 400)
  if (data.byteLength > MAX_ASSET_BYTES) throw new AssetError("Asset larger than 20 MB", 413)

  const existing = (await store().read(name)) ?? (await readBundled(name))
  const reused = Boolean(existing?.data.equals(data))
  if (!reused) await store().write(name, data, mimeType)
  const saved = reused && existing ? existing : ((await store().read(name)) ?? existing)
  return {
    reused,
    asset: {
      name,
      mimeType,
      size: saved?.size ?? data.byteLength,
      modifiedAt: saved?.modifiedAt ?? new Date().toISOString(),
    },
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
