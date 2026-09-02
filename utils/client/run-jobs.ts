import type { IApiError, IGenerateRequest, IGenerateResponse, TApiErrorCode } from "@utils/api-types"
import type { IGenerationJob } from "@utils/brief/jobs"
import type { TCampaignBrief } from "@utils/brief/schema"

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
async function generateOne(
  brief: TCampaignBrief,
  job: IGenerationJob,
  runId: string,
  masterPath: string | undefined,
  signal?: AbortSignal,
): Promise<IGenerateResponse> {
  const body: IGenerateRequest = {
    brief,
    locale: job.locale,
    aspectRatio: job.aspectRatio,
    runId,
    masterPath,
  }
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
  const json = (await res.json().catch(() => null)) as IGenerateResponse | IApiError | null
  if (!res.ok || !json || "error" in json) {
    const message = json && "error" in json ? json.error : `Request failed (${res.status})`
    throw new ApiRequestError(message, json && "error" in json ? json.code : undefined)
  }
  return json
}

// NOTE: Jobs run parents-first: the master, then each locale's master, then every ratio variant
function depth(job: IGenerationJob, byId: Map<string, IGenerationJob>): number {
  let d = 0
  let current: IGenerationJob | undefined = job
  while (current?.masterId) {
    d += 1
    current = byId.get(current.masterId)
  }
  return d
}

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
// NOTE: Carries the server's error code so the studio can react to a class of failure, not just its text
export class ApiRequestError extends Error {
  code?: TApiErrorCode
  constructor(message: string, code?: TApiErrorCode) {
    super(message)
    this.name = "ApiRequestError"
    this.code = code
  }
}

// NOTE: Every run gets a fresh id so its outputs land in their own files instead of replacing earlier ones
export function newRunId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// NOTE: Bounded in-flight requests; each derived job waits for the file its parent produced in this same run
export async function runJobs(briefsById: Map<string, TCampaignBrief>, jobs: IGenerationJob[], opts: IRunOptions): Promise<void> {
  const concurrency = Math.max(1, opts.concurrency ?? 3)
  const byId = new Map(jobs.map((j) => [j.id, j]))
  const queue = [...jobs].sort((a, b) => depth(a, byId) - depth(b, byId))

  const results = new Map<string, Promise<IGenerateResponse | null>>()
  const resolvers = new Map<string, (result: IGenerateResponse | null) => void>()
  for (const j of jobs) {
    results.set(j.id, new Promise<IGenerateResponse | null>((resolve) => resolvers.set(j.id, resolve)))
  }
  const settle = (id: string, result: IGenerateResponse | null) => {
    resolvers.get(id)?.(result)
    resolvers.delete(id)
  }
  const fail = (job: IGenerationJob, error: string, startedAt?: number, code?: TApiErrorCode) => {
    opts.onUpdate({ job, status: "error", error, code, startedAt, finishedAt: Date.now() })
    settle(job.id, null)
  }

  const worker = async () => {
    while (queue.length > 0) {
      if (opts.signal?.aborted) return
      const job = queue.shift()
      if (!job) return
      const brief = briefsById.get(job.campaignId)
      if (!brief) {
        fail(job, "Brief not found")
        continue
      }

      let masterPath: string | undefined
      if (job.masterId) {
        const pending = results.get(job.masterId)
        if (!pending) {
          fail(job, "Parent image is not part of this run")
          continue
        }
        const parent = await pending
        if (opts.signal?.aborted) return
        if (!parent) {
          fail(job, "Parent image failed, so this variant was skipped")
          continue
        }
        masterPath = parent.imagePath
      }

      const startedAt = Date.now()
      opts.onUpdate({ job, status: "running", startedAt })
      try {
        const result = await generateOne(brief, job, opts.runId, masterPath, opts.signal)
        opts.onUpdate({ job, status: "done", result, startedAt, finishedAt: Date.now() })
        settle(job.id, result)
      } catch (err) {
        if (opts.signal?.aborted) {
          fail(job, "Cancelled", startedAt)
          return
        }
        fail(job, err instanceof Error ? err.message : String(err), startedAt, err instanceof ApiRequestError ? err.code : undefined)
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker))
  } finally {
    // NOTE: Unblocks any variant still waiting on a parent that never ran, for example after a cancel
    for (const id of Array.from(resolvers.keys())) settle(id, null)
  }
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
type TJobStatus = "queued" | "running" | "done" | "error"

export interface IJobState {
  job: IGenerationJob
  status: TJobStatus
  result?: IGenerateResponse
  error?: string
  code?: TApiErrorCode
  startedAt?: number
  finishedAt?: number
}

export interface IRun {
  id: string
  startedAt: number
  jobs: IGenerationJob[]
  states: Record<string, IJobState>
}

interface IRunOptions {
  concurrency?: number
  runId: string
  signal?: AbortSignal
  onUpdate: (state: IJobState) => void
}
