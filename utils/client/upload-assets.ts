import type { IAssetUploadResponse } from "@utils/api-types"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
const IMAGE_TYPES = /^image\/(png|jpe?g|webp|heic|heif)$/i
const IMAGE_EXT = /\.(png|jpe?g|webp|heic|heif)$/i

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
export function pickImageFiles(list: FileList | File[]): File[] {
  return Array.from(list).filter((f) => IMAGE_TYPES.test(f.type) || IMAGE_EXT.test(f.name))
}

export async function uploadAssets(files: File[]): Promise<IUploadOutcome> {
  if (files.length === 0) return { names: [], reused: 0, errors: [] }
  const form = new FormData()
  for (const f of files) form.append("files", f)
  const res = await fetch("/api/assets", { method: "POST", body: form })
  const json = (await res.json()) as IAssetUploadResponse | { error: string }
  if ("error" in json) throw new Error(json.error)
  return {
    names: json.saved.map((s) => s.name),
    reused: json.saved.filter((s) => s.reused).length,
    errors: json.errors,
  }
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface IUploadOutcome {
  names: string[]
  reused: number
  errors: Array<{ name: string; message: string }>
}
