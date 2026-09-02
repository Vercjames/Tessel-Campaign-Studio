"use client"
import { BriefInput, type IBriefSource } from "@comps/campaign/brief-input"
import { CampaignForm, SHARED_LOGO_SECTION_ID } from "@comps/campaign/campaign-form"
import { ExampleDownloads } from "@comps/campaign/example-downloads"
import { LogoDropzone } from "@comps/campaign/logo-dropzone"
import { Results } from "@comps/campaign/results"
import { Alert, AlertDescription, AlertTitle } from "@comps/ui/alert"
import { Button, buttonVariants } from "@comps/ui/button"
import { Progress } from "@comps/ui/progress"
import { Separator } from "@comps/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@comps/ui/tabs"
import type { IAssetSummary, IAssetsListResponse, IGenerateResponse, IHealthResponse, IOutputsListResponse } from "@utils/api-types"
import { briefToDraft, emptyDraft, type ICampaignDraft, validateDraft } from "@utils/brief/draft"
import { expandJobs, type IGenerationJob } from "@utils/brief/jobs"
import { type IParseIssue, parseBriefs } from "@utils/brief/parse"
import type { TCampaignBrief } from "@utils/brief/schema"
import { type IJobState, type IRun, newRunId, runJobs } from "@utils/client/run-jobs"
import { cn } from "@utils/cn"
import { AlertTriangle, BookOpen, FilePlus2, FileText } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
const EXAMPLE_BRIEF_URL = "/examples/campaign-brief.yaml"

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function AppMark() {
  return <Image src="/logo.png" alt="Tessel" width={28} height={28} priority className="size-7 rounded-md object-contain" />
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-8 py-16 text-center">
      <FileText className="size-6 text-muted-foreground/60" />
      <p className="text-sm font-medium">No campaign loaded</p>
      <p className="max-w-xs text-sm text-muted-foreground">Drop a brief on the left, load the example, or start a blank campaign.</p>
    </div>
  )
}

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
export function CampaignStudio({ health }: ICampaignStudioProps) {
  const [draft, setDraft] = useState<ICampaignDraft | null>(null)
  const [failure, setFailure] = useState<IParseFailure | null>(null)
  const [library, setLibrary] = useState<IAssetSummary[]>([])
  const [runs, setRuns] = useState<IRun[]>([])
  const [running, setRunning] = useState(false)
  const [loadingExample, setLoadingExample] = useState(false)
  const [tab, setTab] = useState<TStudioTab>("campaign")
  const abortRef = useRef<AbortController | null>(null)

  // NOTE: Loaders lock while a brief is open so a stray drop cannot replace it
  const locked = draft !== null

  const refreshLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/assets")
      const json = (await res.json()) as IAssetsListResponse
      setLibrary(json.assets)
    } catch {
      toast.error("Could not load asset library")
    }
  }, [])

  useEffect(() => {
    void refreshLibrary()
  }, [refreshLibrary])

  const validation = useMemo(() => (draft ? validateDraft(draft) : null), [draft])

  const latest = runs[0]
  const trackedJobs = useMemo(() => latest?.jobs ?? [], [latest])
  const doneCount = trackedJobs.filter((j) => latest?.states[j.id]?.status === "done").length
  const errorCount = trackedJobs.filter((j) => latest?.states[j.id]?.status === "error").length
  const progress = trackedJobs.length > 0 ? ((doneCount + errorCount) / trackedJobs.length) * 100 : 0

  function loadSource(src: IBriefSource) {
    const result = parseBriefs(src.text, src.name)
    if (!result.ok) {
      setFailure({ source: src.name, issues: result.issues })
      toast.error(`${src.name}: ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"}`)
      return
    }
    if (result.briefs.length > 1) {
      toast.warning(`${src.name} holds ${result.briefs.length} campaigns. Only the first was loaded.`)
    }
    setFailure(null)
    setRuns([])
    setDraft(briefToDraft(result.briefs[0], src.name))
    void restore(result.briefs[0])
  }

  async function restore(brief: TCampaignBrief) {
    const jobs = expandJobs(brief)
    if (jobs.length === 0) return
    try {
      const res = await fetch(`/api/outputs?campaign=${encodeURIComponent(jobs[0].campaignId)}`)
      if (!res.ok) return
      const json = (await res.json()) as IOutputsListResponse
      const jobById = new Map(jobs.map((j) => [j.id, j]))
      const byRun = new Map<string, IRun>()
      for (const output of json.outputs) {
        const job = jobById.get(output.jobId)
        if (!job) continue
        const at = Date.parse(output.createdAt)
        const finishedAt = Number.isNaN(at) ? undefined : at
        let run = byRun.get(output.runId)
        if (!run) {
          run = { id: output.runId, startedAt: finishedAt ?? 0, jobs: [], states: {} }
          byRun.set(output.runId, run)
        }
        if (run.states[job.id]) continue
        run.jobs.push(job)
        run.states[job.id] = { job, status: "done", result: output, finishedAt }
        if (finishedAt !== undefined && (run.startedAt === 0 || finishedAt < run.startedAt)) run.startedAt = finishedAt
      }
      const restored = Array.from(byRun.values()).sort((a, b) => b.startedAt - a.startedAt)
      for (const run of restored) run.jobs.sort((a, b) => a.id.localeCompare(b.id))
      if (restored.length === 0) return
      setRuns(restored)
      setTab("results")
      toast.success(`Restored ${restored.length} earlier run${restored.length === 1 ? "" : "s"}`)
    } catch {
      toast.error("Could not read earlier results")
    }
  }

  function onFiles(sources: IBriefSource[]) {
    if (sources.length === 0) return
    if (sources.length > 1) toast.warning("One brief at a time. Only the first file was loaded.")
    loadSource(sources[0])
  }

  async function loadExample() {
    setLoadingExample(true)
    try {
      const res = await fetch(EXAMPLE_BRIEF_URL)
      if (!res.ok) throw new Error(`Example not found (${res.status})`)
      loadSource({ name: "campaign-brief.yaml", text: await res.text() })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load the example")
    } finally {
      setLoadingExample(false)
    }
  }

  function clear() {
    setDraft(null)
    setFailure(null)
    setRuns([])
    setTab("campaign")
  }

  async function dispatch(brief: TCampaignBrief, only?: IGenerationJob[], resume?: IResume) {
    if (!health.geminiConfigured) {
      toast.error("GEMINI_API_KEY is not set. Add it to .env.local and restart.")
      return
    }
    const jobs = only ?? expandJobs(brief)
    if (jobs.length === 0) return
    if (!brief.brand?.logo) toast.info("No shared logo set, so none will appear on the images.")
    else if (brief.logoPlacement.length === 0) toast.warning("A logo is set but no placement is selected, so it will not appear.")

    const controller = new AbortController()
    abortRef.current = controller
    const runId = resume?.runId ?? newRunId()
    const queued = Object.fromEntries(jobs.map((j) => [j.id, { job: j, status: "queued" } satisfies IJobState]))
    setRunning(true)
    setTab("results")
    // NOTE: A resubmit re-queues the failed tiles inside their own run, so the run id and file names stay put
    if (resume) setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, states: { ...r.states, ...queued } } : r)))
    else setRuns((prev) => [{ id: runId, startedAt: Date.now(), jobs, states: queued } satisfies IRun, ...prev])
    // NOTE: A legal rejection applies to the whole brief, so the run stops on the first one and is reported once
    let legalReported = false
    const update = (s: IJobState) => {
      setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, states: { ...r.states, [s.job.id]: s } } : r)))
      if (s.status === "error" && s.code === "legal" && !legalReported) {
        legalReported = true
        controller.abort()
        toast.error("Brief blocked by legal check", { description: s.error, duration: 10_000 })
        setTab("campaign")
      }
    }
    try {
      await runJobs(new Map([[brief.id as string, brief]]), jobs, {
        concurrency: 3,
        runId,
        signal: controller.signal,
        seed: resume?.seed,
        onUpdate: update,
      })
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  // NOTE: Resubmits the failed job plus any failed variant that descends from it, with finished parents as seed
  function resubmit(runId: string, job: IGenerationJob) {
    const run = runs.find((r) => r.id === runId)
    if (!run) return
    if (!validation?.ok) {
      toast.error("Fix the highlighted fields first.")
      return
    }
    const byId = new Map(run.jobs.map((j) => [j.id, j]))
    const descendsFrom = (candidate: IGenerationJob) => {
      let current: IGenerationJob | undefined = candidate
      while (current?.masterId) {
        if (current.masterId === job.id) return true
        current = byId.get(current.masterId)
      }
      return false
    }
    const jobs = run.jobs.filter((j) => j.id === job.id || (run.states[j.id]?.status === "error" && descendsFrom(j)))
    const seed: Record<string, IGenerateResponse> = {}
    for (const s of Object.values(run.states)) if (s.status === "done" && s.result) seed[s.job.id] = s.result
    void dispatch(validation.brief, jobs, { runId, seed })
  }

  function generate() {
    if (!validation?.ok) {
      toast.error("Fix the highlighted fields first.")
      return
    }
    void dispatch(validation.brief)
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <AppMark />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">Tessel</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Campaign Studio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground md:inline">
              {health.model}
            </span>
            <ExampleDownloads />
            <Link href="/spec" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <BookOpen data-icon="inline-start" />
              Brief spec
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-6 pb-16 pt-10">
        <header className="max-w-2xl space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">Brief in. Campaign out.</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Everything the campaign needs is in the brief. Load it and Tessel handles the rest.
          </p>
        </header>

        {!health.geminiConfigured ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Gemini is not configured</AlertTitle>
            <AlertDescription>
              Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code>, set{" "}
              <code className="font-mono">GEMINI_API_KEY</code>, and restart the dev server. You can still prepare a campaign meanwhile.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-stretch">
          <aside className={cn("flex flex-col gap-6", locked && "lg:sticky lg:top-20 lg:self-start")}>
            <div className="flex flex-1 flex-col gap-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Load a brief</p>
              <BriefInput
                onFiles={onFiles}
                disabled={running || locked}
                className="flex-1"
                hint={locked ? "Clear the current campaign to load a new brief." : undefined}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="secondary" disabled={running || locked || loadingExample} onClick={() => void loadExample()}>
                  <FileText data-icon="inline-start" />
                  {loadingExample ? "Loading" : "Load example"}
                </Button>
                <Button type="button" variant="outline" disabled={running || locked} onClick={() => setDraft(emptyDraft())}>
                  <FilePlus2 data-icon="inline-start" />
                  Blank campaign
                </Button>
              </div>
            </div>

            {draft ? (
              <>
                <Separator />
                <div id={SHARED_LOGO_SECTION_ID} className="flex flex-1 scroll-mt-24 flex-col gap-3">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Shared logo</p>
                  <LogoDropzone
                    value={draft.logo}
                    onChange={(name) => setDraft({ ...draft, logo: name })}
                    library={library}
                    onLibraryChange={() => void refreshLibrary()}
                    disabled={running}
                    className="flex-1"
                  />
                </div>
              </>
            ) : null}

            {failure ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle className="flex items-center justify-between gap-2">
                  <span>{failure.source}</span>
                  <Button type="button" size="xs" variant="ghost" onClick={() => setFailure(null)}>
                    Dismiss
                  </Button>
                </AlertTitle>
                <AlertDescription>
                  <ul className="space-y-0.5 font-mono text-xs">
                    {failure.issues.slice(0, 8).map((i) => (
                      <li key={`${i.path}:${i.message}`}>
                        {i.path ? <span className="text-foreground">{i.path}: </span> : null}
                        {i.message}
                      </li>
                    ))}
                    {failure.issues.length > 8 ? <li>and {failure.issues.length - 8} more</li> : null}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
          </aside>

          <div className="flex flex-col gap-3">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Active campaign</p>
            {draft || trackedJobs.length > 0 ? (
              <Tabs value={tab} onValueChange={(v) => setTab(v as TStudioTab)}>
                <TabsList variant="line">
                  <TabsTrigger value="campaign">Campaign</TabsTrigger>
                  <TabsTrigger value="results" disabled={trackedJobs.length === 0}>
                    Results
                    {trackedJobs.length > 0 ? (
                      <span className="rounded-full bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                        {doneCount}/{trackedJobs.length}
                      </span>
                    ) : null}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="campaign" keepMounted className="pt-4">
                  {draft ? (
                    <CampaignForm
                      key={draft.key}
                      draft={draft}
                      onChange={setDraft}
                      onRemove={clear}
                      onGenerate={generate}
                      onStop={() => abortRef.current?.abort()}
                      running={running}
                      library={library}
                      onLibraryChange={() => void refreshLibrary()}
                      disabled={running}
                      canGenerate={health.geminiConfigured && !running}
                    />
                  ) : (
                    <EmptyState />
                  )}
                </TabsContent>

                <TabsContent value="results" className="pt-4">
                  <section className="space-y-6 rounded-xl border bg-card px-6 py-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl font-semibold tracking-tight">Latest run</h2>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {doneCount} ready
                          {errorCount > 0 ? ` · ${errorCount} failed` : ""}
                          {running ? ` · ${trackedJobs.length - doneCount - errorCount} pending` : ""}
                        </span>
                      </div>
                      <Progress value={progress} />
                    </div>
                    <Results runs={runs} onResubmit={resubmit} busy={running} />
                  </section>
                </TabsContent>
              </Tabs>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
type TStudioTab = "campaign" | "results"

interface ICampaignStudioProps {
  health: IHealthResponse
}

interface IParseFailure {
  source: string
  issues: IParseIssue[]
}

interface IResume {
  runId: string
  seed: Record<string, IGenerateResponse>
}
