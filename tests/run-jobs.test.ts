import type { IGenerateResponse } from "@utils/api-types"
import type { IGenerationJob } from "@utils/brief/jobs"
import { type IJobState, runJobs } from "@utils/client/run-jobs"
import { afterEach, describe, expect, it, vi } from "vitest"

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function job(id: string, aspectRatio: "16:9" | "1:1", masterId: string | null): IGenerationJob {
  return { id, masterId, campaignId: "c", campaignName: "C", aspectRatio, locale: "en", assetNames: [] }
}

function result(jobId: string): IGenerateResponse {
  return {
    jobId,
    runId: "r1",
    masterJobId: null,
    campaignId: "c",
    campaignName: "C",
    aspectRatio: "16:9",
    locale: "en",
    imageUrl: `/api/outputs/${jobId}.png`,
    imagePath: `${jobId}.png`,
    reviewUrl: "/results/x",
    mimeType: "image/png",
    model: "m",
    prompt: "",
    headline: null,
    assetsUsed: [],
    assetsMissing: [],
    note: null,
    createdAt: "now",
  }
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
describe("runJobs", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("a resubmitted variant takes its parent path from the seed", async () => {
    const bodies: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)))
        return new Response(JSON.stringify(result("c/en/1x1")), { status: 200 })
      }),
    )
    const states: IJobState[] = []
    const variant = job("c/en/1x1", "1:1", "c/en/16x9")
    const brief = { id: "c" } as never
    await runJobs(new Map([["c", brief]]), [variant], {
      runId: "r1",
      seed: { "c/en/16x9": result("c/en/16x9") },
      onUpdate: (s) => states.push(s),
    })
    expect(bodies[0].masterPath).toBe("c/en/16x9.png")
    expect(states.at(-1)?.status).toBe("done")
  })

  it("without a seed a lone variant fails before any request", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const states: IJobState[] = []
    await runJobs(new Map([["c", { id: "c" } as never]]), [job("c/en/1x1", "1:1", "c/en/16x9")], {
      runId: "r1",
      onUpdate: (s) => states.push(s),
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(states.at(-1)).toMatchObject({ status: "error", error: "Parent image is not part of this run" })
  })

  it("carries the server error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Gemini timed out", code: "timeout" }), { status: 504 })),
    )
    const states: IJobState[] = []
    await runJobs(new Map([["c", { id: "c" } as never]]), [job("c/en/16x9", "16:9", null)], {
      runId: "r1",
      onUpdate: (s) => states.push(s),
    })
    expect(states.at(-1)).toMatchObject({ status: "error", code: "timeout", error: "Gemini timed out" })
  })
})
