import { BlobNotFoundError } from "@vercel/blob"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
vi.mock("server-only", () => ({}))
vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vercel/blob")>()),
  get: vi.fn(),
  head: vi.fn(),
  list: vi.fn(),
  put: vi.fn(),
}))
vi.stubEnv("STORAGE", "blob")

const blob = vi.mocked(await import("@vercel/blob"))
const { storageFor } = await import("@utils/server/storage")

const BLOB_URL = "https://store.public.blob.vercel-storage.com/assets/Logo%20-%201%20-%20sx.png"

function streamOf(text: string): ReadableStream<Uint8Array> {
  return new Blob([text]).stream()
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
describe("BlobStorage.read", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // NOTE: The CDN can still answer "not found" for a moment after a write, so the lookup goes through the
  // ↪ API and the bytes are fetched at a per-version URL the CDN has never cached
  it("looks the blob up through the API and fetches a per-version URL", async () => {
    blob.head.mockResolvedValue({
      url: BLOB_URL,
      downloadUrl: `${BLOB_URL}?download=1`,
      pathname: "assets/Logo - 1 - sx.png",
      size: 9627,
      contentType: "image/png",
      contentDisposition: "inline",
      cacheControl: "public, max-age=2592000",
      uploadedAt: new Date("2026-09-02T19:30:33.000Z"),
      etag: '"abc123"',
    })
    blob.get.mockResolvedValue({
      statusCode: 200,
      stream: streamOf("png-bytes"),
      headers: new Headers(),
      blob: { contentType: "image/png", size: 9627, uploadedAt: new Date("2026-09-02T19:30:33.000Z") },
    } as never)

    const file = await storageFor("/assets", "assets/").read("Logo - 1 - sx.png")

    expect(blob.head).toHaveBeenCalledWith("assets/Logo - 1 - sx.png")
    expect(blob.get).toHaveBeenCalledWith(`${BLOB_URL}?v=abc123`, { access: "public" })
    expect(file).toEqual({
      data: Buffer.from("png-bytes"),
      contentType: "image/png",
      size: 9627,
      modifiedAt: "2026-09-02T19:30:33.000Z",
    })
  })

  it("returns null without touching the CDN when the blob does not exist", async () => {
    blob.head.mockRejectedValue(new BlobNotFoundError())

    const file = await storageFor("/assets", "assets/").read("missing.png")

    expect(file).toBeNull()
    expect(blob.get).not.toHaveBeenCalled()
  })
})
