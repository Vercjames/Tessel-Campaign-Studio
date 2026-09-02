import { CampaignStudio } from "@comps/campaign/campaign-studio"
import type { IHealthResponse } from "@utils/api-types"
import { ASSETS_DIR } from "@utils/server/assets"
import { imageModel, isGeminiConfigured } from "@utils/server/gemini"
import { OUTPUTS_DIR } from "@utils/server/outputs"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
export const dynamic = "force-dynamic"

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export default function Home() {
  const health: IHealthResponse = {
    geminiConfigured: isGeminiConfigured(),
    model: imageModel(),
    assetsDir: ASSETS_DIR,
    outputsDir: OUTPUTS_DIR,
  }
  return (
    <main className="flex flex-1 flex-col">
      <CampaignStudio health={health} />
    </main>
  )
}
