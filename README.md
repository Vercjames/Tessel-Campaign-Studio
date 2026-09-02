# **Tessel Campaign Studio**
*By Verc James*

Brief in, campaign images out. Load a JSON/YAML brief, add a logo and reference shots, and Gemini renders one creative per aspect ratio and locale.

---

## 🔗 **Quick Links**

- **Dev**
  - [Live App](http://localhost:3000)
- **Production**
  - [Live App](https://tessel-campaign-studio.vercel.app/)
  - [Video Guide](https://youtu.be/39v3-N8aLTo)

---

## ⚙️ **Project Requirements**

- [Node](https://nodejs.org/en) <sub>*20.9+, npm included*</sub>
- [Gemini API Key](https://aistudio.google.com/apikey) <sub>*billing enabled*</sub>

---

## 🧠 **Project Tech Stack**

- [Next](https://nextjs.org/)
- [React](https://react.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Gemini API](https://ai.google.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zod](https://zod.dev/)
---

## 🌍 **Project Environment**

```bash
cp .env.example .env.local
```

| Variable          | Required | Purpose                                                                             |
|-------------------|----------|-------------------------------------------------------------------------------------|
| `GEMINI_API_KEY`  | Yes      | Gemini API key                                                                      |
| `LEGAL_BLOCKLIST` | No       | Extra prohibited words for the legal check, comma-separated. Profanity is built in. |

> ⚠️ A `429` from Gemini means billing is off for that key.

On Vercel, set `GEMINI_API_KEY` in the project settings and attach a public Blob store (Storage tab, Create Database, Blob, Connect to Project). Deployments then write outputs and uploads to Blob; local runs keep using the disk.

---

## 🧪 **Project Commands**

```bash
npm install
npm run dev
```

```bash
npm run build
npm test
npm run lint
npm run readme:sync   # re-embed the example brief below
```

---

## 📄 **Example Input**

`public/examples/campaign-brief.yaml` (also in JSON). Field reference at `/spec`.

<!-- include:example-brief -->
```yaml
campaign: Summer Fitness Program
id: summer-fitness
region: Southwest US
audience: Active adults 25–40 seeking a summer fitness program
message: Find out how to get started.
locales: [en]
aspectRatio: ["16:9", "1:1"]

brand:
  logo: tessel-logo.png
  colors:
    primary: "#0E7C86"
    secondary: "#F4F1EA"
    tone: "#F59E0B"
logoPlacement: [corner]
logoPosition: bottom-right

avoid: no faces, no people. no extra text beyond the message

products:
  - id: towel
    name: Gym Towel
    kind: product
    description: A folded charcoal microfiber towel with a woven teal edge, draped over a bench

  - id: water-bottle
    name: Water Bottle
    kind: product
    description: Our member only matte black insulated bottle with a bamboo cap
    referenceImages: [modern-waterbottle.png]

  - id: gym
    name: Modern gym
    kind: composition
    description: Bright modern gym floor at golden hour, polished concrete, soft haze
    referenceImages:
      - file: modern-gym.png
        roles: [background, atmosphere]
```
<!-- /include:example-brief -->

Notes:
- All products land in one scene per ratio/locale.
- `kind: composition` items describe the setting, not a product.
- `message` is the only text drawn. Omit it for no text.
- Images are filenames in the asset library: the repo's `assets/` folder plus anything uploaded in the app (on Vercel, uploads live in Blob, not the repo). Missing ones are skipped and the model works from the description.

---

## 🖼️ **Example Output**

Local, one folder per campaign:

```
storage/outputs/summer-fitness/
  en__16x9__<run>.png        final, logo composited
  en__16x9__<run>__raw.png   before the logo
  en__16x9__<run>.json       prompt, model, assets used/missing
  en__1x1__<run>.png
  es__16x9__<run>.png
```

Download all (Results tab), one zip per run, a folder per ratio:

```
summer-fitness__2026-09-02_13-21.zip
  summer-fitness__2026-09-02_13-21/
    16x9/
      summer-fitness__en.png
      summer-fitness__es.png
    1x1/
      summer-fitness__en.png
      summer-fitness__es.png
```

Each result also has a review page at `/results/...`.

---

## 🧭 **Key Design Decisions**

- One brief, one picture. Products are composed together, not rendered separately.
- The first locale at the first ratio is the master. Other locales re-render with the master attached and only the text changes. Other ratios are regenerated with the master attached, so the composition adapts to the frame and nothing is cropped or padded.
- The logo is composited from the file with sharp, never drawn by the model.
- The form and the YAML are the same thing. Anything set in the UI exports back out.
- Legal check runs in the API route. Every text field is scanned for profanity; a hit gets a 422 before anything is generated. `LEGAL_BLOCKLIST` in `.env.local` adds words.
- Brand check is by construction: the logo is always the real file, and the JSON sidecar records which assets were used or missing.

---

## 📌 **Assumptions & Limitations**

- No billing, no images.
- No per-product outputs. Folders are campaign/locale/ratio.
- Translations come from the model and are not reviewed.
- The legal check is a word list. Misspellings get through.
- Brand colors are prompted, not measured on the output.
- A `.heic` logo uploads but fails at compositing. Use png/jpg/webp for the logo.
- On Vercel everything is stored in a public Blob store, so every output and upload also has a direct `*.public.blob.vercel-storage.com` URL.
- All work product is public. There is no auth. Anyone who knows a campaign slug can list and open its results at `/api/outputs?campaign=<slug>` and `/results/...`, and every uploaded asset is served at `/api/assets/<name>`. Run it locally, or put it behind auth, for anything real.
