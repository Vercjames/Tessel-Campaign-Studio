import "server-only"
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { BlobNotFoundError, get, head, list, put } from "@vercel/blob"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
// NOTE: Disk is the default everywhere; Vercel has no writable disk, so deployments switch to Blob
// ↪ HOWEVER: STORAGE=blob or STORAGE=disk overrides the choice, for example to try Blob from a local run
const DRIVER: TStorageDriver =
  process.env.STORAGE === "blob" || process.env.STORAGE === "disk" ? process.env.STORAGE : process.env.VERCEL ? "blob" : "disk"

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".json": "application/json",
}

const drivers = new Map<string, IStorage>()

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
// NOTE: Keys are forward-slash paths relative to the root; any traversal or empty segment is refused
function assertKey(key: string): string[] {
  const segments = key.split("/")
  if (segments.length === 0 || segments.some((s) => !s || s === "." || s === "..")) throw new Error(`Invalid storage key "${key}"`)
  return segments
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

class DiskStorage implements IStorage {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, ...assertKey(key))
    if (!full.startsWith(`${this.root}${path.sep}`)) throw new Error(`Invalid storage key "${key}"`)
    return full
  }

  async read(key: string): Promise<IStoredFile | null> {
    const full = this.resolve(key)
    try {
      const [data, s] = await Promise.all([readFile(full), stat(full)])
      return { data, contentType: mimeForKey(key), size: s.size, modifiedAt: s.mtime.toISOString() }
    } catch {
      return null
    }
  }

  async write(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, data)
  }

  async list(prefix: string): Promise<IStoredEntry[]> {
    const dir = prefix ? this.resolve(prefix.replace(/\/$/, "")) : this.root
    let names: string[]
    try {
      names = await readdir(dir)
    } catch {
      return []
    }
    const out: IStoredEntry[] = []
    for (const name of names) {
      const s = await stat(path.join(dir, name))
      if (!s.isFile()) continue
      out.push({ key: `${prefix}${name}`, size: s.size, modifiedAt: s.mtime.toISOString() })
    }
    return out
  }
}

// NOTE: The store is public, so the browser could read blob URLs directly; files are still served through
// ↪ the API routes so URLs stay the same across drivers
class BlobStorage implements IStorage {
  constructor(private readonly prefix: string) {}

  private key(key: string): string {
    assertKey(key)
    return `${this.prefix}${key}`
  }

  // NOTE: Reading the bare blob URL goes through the CDN, which can still answer "not found" for a moment after
  // ↪ a write and serves an overwritten file for up to a minute; the public store has no way to bypass that
  // ↪ ERGO: The lookup goes through the API, and the bytes are fetched at a per-version URL the CDN has never cached
  async read(key: string): Promise<IStoredFile | null> {
    let meta: Awaited<ReturnType<typeof head>>
    try {
      meta = await head(this.key(key))
    } catch (err) {
      if (err instanceof BlobNotFoundError) return null
      throw err
    }
    const url = new URL(meta.url)
    url.searchParams.set("v", meta.etag.replace(/"/g, ""))
    const result = await get(url.toString(), { access: "public" })
    if (!result || result.statusCode !== 200) return null
    const data = await streamToBuffer(result.stream)
    return {
      data,
      contentType: meta.contentType || result.blob.contentType || mimeForKey(key),
      size: meta.size,
      modifiedAt: meta.uploadedAt.toISOString(),
    }
  }

  async write(key: string, data: Buffer, contentType: string): Promise<void> {
    await put(this.key(key), data, { access: "public", contentType, allowOverwrite: true, addRandomSuffix: false })
  }

  async list(prefix: string): Promise<IStoredEntry[]> {
    const full = `${this.prefix}${prefix}`
    const out: IStoredEntry[] = []
    let cursor: string | undefined
    do {
      const page = await list({ prefix: full, cursor, limit: 1000 })
      for (const blob of page.blobs) {
        const rest = blob.pathname.slice(this.prefix.length)
        if (rest.slice(prefix.length).includes("/")) continue
        out.push({ key: rest, size: blob.size, modifiedAt: blob.uploadedAt.toISOString() })
      }
      cursor = page.hasMore ? page.cursor : undefined
    } while (cursor)
    return out
  }
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export function mimeForKey(key: string): string {
  return MIME_BY_EXT[path.extname(key).toLowerCase()] ?? "application/octet-stream"
}

export function storageDriver(): TStorageDriver {
  return DRIVER
}

// NOTE: One driver per root; disk roots are absolute folders, blob roots are pathname prefixes in the one store
export function storageFor(root: string, blobPrefix: string): IStorage {
  const id = `${DRIVER}:${root}`
  let driver = drivers.get(id)
  if (!driver) {
    driver = DRIVER === "blob" ? new BlobStorage(blobPrefix) : new DiskStorage(root)
    drivers.set(id, driver)
  }
  return driver
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
export type TStorageDriver = "disk" | "blob"

export interface IStoredFile {
  data: Buffer
  contentType: string
  size: number
  modifiedAt: string
}

export interface IStoredEntry {
  key: string
  size: number
  modifiedAt: string
}

export interface IStorage {
  read(key: string): Promise<IStoredFile | null>
  write(key: string, data: Buffer, contentType: string): Promise<void>
  list(prefix: string): Promise<IStoredEntry[]>
}
