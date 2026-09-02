"use client"
import { Badge } from "@comps/ui/badge"
import { Button, buttonVariants } from "@comps/ui/button"
import type { IGenerationJob } from "@utils/brief/jobs"
import type { IJobState, IRun } from "@utils/client/run-jobs"
import JSZip from "jszip"
import { AlertCircle, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
const RATIO_LABELS: Record<string, string> = {
  "1:1": "square",
  "2:3": "portrait",
  "3:2": "landscape",
  "3:4": "portrait",
  "4:3": "landscape",
  "9:16": "story",
  "16:9": "wide",
  "21:9": "banner",
}

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function extFor(mimeType?: string): string {
  return mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png"
}

function fileName(job: IGenerationJob, runId: string, mimeType?: string): string {
  const ratio = job.aspectRatio.replace(":", "x")
  return `${job.campaignId}__${job.locale}__${ratio}__${runId}.${extFor(mimeType)}`
}

function runStamp(run: IRun): string {
  if (!run.startedAt) return run.id
  const d = new Date(run.startedAt)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`
}

function ratioValue(aspectRatio: string): number {
  const [w, h] = aspectRatio.split(":").map(Number)
  return w > 0 && h > 0 ? w / h : 1
}

const TILE_HEIGHT = 240

function countStatus(jobs: IGenerationJob[], states: Record<string, IJobState>, status: IJobState["status"]): number {
  return jobs.filter((j) => states[j.id]?.status === status).length
}

// NOTE: One zip per run, a folder per ratio ("16x9", since ":" is not a legal folder name), a file per locale
async function downloadAll(run: IRun): Promise<void> {
  const done = run.jobs.filter((j) => run.states[j.id]?.status === "done" && run.states[j.id]?.result)
  if (done.length === 0) return
  const campaign = done[0].campaignId
  const root = `${campaign}__${runStamp(run)}`
  const zip = new JSZip()
  await Promise.all(
    done.map(async (job) => {
      const result = run.states[job.id].result
      if (!result) return
      const res = await fetch(result.imageUrl)
      if (!res.ok) throw new Error(`Could not fetch ${job.locale} ${job.aspectRatio}`)
      const folder = job.aspectRatio.replace(":", "x")
      zip.file(`${root}/${folder}/${campaign}__${job.locale}.${extFor(result.mimeType)}`, await res.blob())
    }),
  )
  const blob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${root}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function formatStarted(ms: number): string {
  if (!ms) return "earlier"
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function ResultTile({ job, state, runId, onResubmit, busy }: IResultTileProps) {
  const status = state?.status ?? "queued"
  const ratio = ratioValue(job.aspectRatio)
  const width = Math.round(TILE_HEIGHT * ratio)
  const frameStyle = { aspectRatio: `${job.aspectRatio.replace(":", " / ")}` }
  const frameClass = "relative block w-full overflow-hidden rounded-lg bg-muted/40 text-left"
  const result = status === "done" ? state?.result : undefined
  const Frame = result ? (
    <a href={result.reviewUrl} target="_blank" rel="noopener" className={frameClass} style={frameStyle} aria-label="Review result">
      {/* biome-ignore lint/performance/noImgElement: generated at runtime */}
      <img
        src={result.imageUrl}
        alt={`${job.campaignName}, ${job.locale}, ${job.aspectRatio}`}
        className="size-full object-cover transition-transform duration-300 ease-out-quart group-hover:scale-[1.03]"
      />
    </a>
  ) : (
    <div className={frameClass} style={frameStyle}>
      {status === "running" ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-xs">Generating</span>
        </div>
      ) : status === "error" ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-destructive">
          <AlertCircle className="size-5" />
          <span className="line-clamp-4 text-xs leading-snug">{state?.error}</span>
          {onResubmit ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="mt-1 text-foreground"
              disabled={busy}
              onClick={() => onResubmit(runId, job)}
              title={state?.code === "timeout" ? "The model timed out; the same job is sent again" : "Send this job again"}
            >
              <RotateCcw data-icon="inline-start" />
              Resubmit
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground/70">
          <Sparkles className="size-5" />
          <span className="text-xs">Queued</span>
        </div>
      )}
    </div>
  )

  return (
    <div
      className="group flex shrink-0 snap-start scroll-ml-2 flex-col gap-2.5 rounded-xl border bg-card p-2 shadow-sm"
      style={{ width: width + 16 }}
    >
      {Frame}
      <div className="flex h-6 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span className="truncate">
            <span className="uppercase">{job.locale}</span> · {job.aspectRatio} {RATIO_LABELS[job.aspectRatio] ?? ""}
          </span>
          {job.masterId === null ? (
            <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px] uppercase">
              master
            </Badge>
          ) : null}
          {result && result.assetsMissing.length > 0 ? (
            <Badge
              variant="outline"
              className="h-4 shrink-0 border-amber-500/40 bg-amber-500/10 px-1 text-[9px] uppercase text-amber-700 dark:text-amber-400"
              title={`Missing from library: ${result.assetsMissing.join(", ")}`}
            >
              missing refs
            </Badge>
          ) : null}
        </div>
        {result ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <a
              href={result.reviewUrl}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
              aria-label="Review result"
              title="Open review page"
            >
              <ExternalLink />
            </a>
            <a
              href={result.imageUrl}
              download={fileName(job, runId, result.mimeType)}
              className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
              aria-label="Download image"
              title="Download image"
            >
              <Download />
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// NOTE: Native scroll-snap does the carousel work; the arrows only nudge it and grey out at the ends
function Strip({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    measure()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  const nudge = (dir: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" })
  }

  return (
    <div className="space-y-2">
      {!(atStart && atEnd) ? (
        <div className="flex items-center justify-end gap-1.5">
          <Button type="button" size="icon" variant="outline" disabled={atStart} onClick={() => nudge(-1)} aria-label="Scroll left">
            <ChevronLeft />
          </Button>
          <Button type="button" size="icon" variant="outline" disabled={atEnd} onClick={() => nudge(1)} aria-label="Scroll right">
            <ChevronRight />
          </Button>
        </div>
      ) : null}
      <div ref={ref} onScroll={measure} className="-mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 py-2 scrollbar-none">
        {children}
      </div>
    </div>
  )
}

function RunResults({ run, latest, onResubmit, busy }: IRunResultsProps) {
  const done = countStatus(run.jobs, run.states, "done")
  const failed = countStatus(run.jobs, run.states, "error")
  const [zipping, setZipping] = useState(false)

  async function onDownloadAll() {
    setZipping(true)
    try {
      await downloadAll(run)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build the zip")
    } finally {
      setZipping(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-lg font-semibold tracking-tight">{run.jobs[0]?.campaignName ?? "Campaign"}</h3>
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span>{formatStarted(run.startedAt)}</span>
            {latest ? (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] uppercase">
                latest
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button type="button" size="sm" variant="outline" disabled={done === 0 || zipping} onClick={() => void onDownloadAll()}>
            {zipping ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Download data-icon="inline-start" />}
            {zipping ? "Zipping" : `Download all${done > 1 ? ` (${done})` : ""}`}
          </Button>
          <span className="font-mono text-[11px] text-muted-foreground">
            {done}/{run.jobs.length} ready{failed > 0 ? ` · ${failed} failed` : ""}
          </span>
        </div>
      </div>
      <Strip>
        {run.jobs.map((job) => (
          <ResultTile key={job.id} job={job} state={run.states[job.id]} runId={run.id} onResubmit={onResubmit} busy={busy} />
        ))}
      </Strip>
    </section>
  )
}

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
export function Results({ runs, onResubmit, busy }: IResultsProps) {
  return (
    <div className="space-y-12">
      {runs.map((run, i) => (
        <RunResults key={run.id} run={run} latest={i === 0} onResubmit={onResubmit} busy={busy} />
      ))}
    </div>
  )
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
type TResubmit = (runId: string, job: IGenerationJob) => void

interface IResultsProps {
  runs: IRun[]
  onResubmit?: TResubmit
  busy?: boolean
}

interface IRunResultsProps {
  run: IRun
  latest: boolean
  onResubmit?: TResubmit
  busy?: boolean
}

interface IResultTileProps {
  job: IGenerationJob
  state: IJobState | undefined
  runId: string
  onResubmit?: TResubmit
  busy?: boolean
}
