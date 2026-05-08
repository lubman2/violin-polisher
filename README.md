# Violin Polisher

> Browser-based AI audio polish tool for solo violin (pickup/DI recordings)
> Clean up, EQ, compress, add stereo width & reverb — all in the browser via FFmpeg.wasm.

## Problem

Kamarád posílá mono nahrávky houslí (snímač → zvuková karta). Tyto nahrávky trpí:
- **Piezo quack** — nepřirozené rezonance ~800-1200 Hz
- **Chybí prostor** — snímač nechyta akustiku místnosti
- **Mono** — ploché stereo
- **Nevyrovnaná dynamika** — nerovnoměrné tempo, dynamické špičky
- **Šum/Hum** — ze zvukové karty a predampu

## Solution

Webová aplikace, kde kamarád:
1. Nahraje WAV/MP3 soubor
2. Vybere preset (Classical Hall, Intimate Studio, etc.)
3. Zpracování proběhne **kompletně v browseru** (FFmpeg.wasm) — žádný upload na server
4. Stáhne zpracovaný soubor + může poslouchat A/B porovnání

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client-Side)                     │
│                                                                   │
│  [Input File]                                                      │
│       │                                                            │
│       ▼                                                            │
│  ┌──────────┐    ┌──────────┐    ┌───────────┐   ┌───────────┐    │
│  │ 1.CLEAN  │───▶│  2.EQ    │───▶│ 3.DYNAMICS│──▶│ 4.STEREO  │    │
│  │ (denoise)│    │(piezo fix│    │ (compress) │   │ (Haas/IR │    │
│  └──────────┘    └──────────┘    └───────────┘   └──────────┬──┘    │
│                                                            │       │
│                                                            ▼       │
│  ┌──────────┐    ┌──────────┐                               │       │
│  │ 6.MASTER │◀───│ 5.REVERB │◀───────────────────────────────┘       │
│  │ (loudnorm)│    │ (hall)   │                                         │
│  └────┬─────┘    └──────────┘                                         │
│       │                                                                │
│       ▼                                                                │
│  [Output WAV/MP3] ← Download                                          │
│                                                                        │
│  FFmpeg.wasm → All processing runs in browser WebWorker               │
│  Zero server-side processing. Zero audio uploads.                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Processing Pipeline Detail

| Phase | FFmpeg Filter | Purpose |
|-------|---------------|---------|
| **Clean** | `highpass`, `afftdn` | Remove rumble & noise |
| **EQ** | `equalizer` (6-band) | Fix piezo quack, boost presence, add air |
| **Compress** | `acompressor` | Gentle dynamics (ratio 2-3:1, slow attack) |
| **Stereo** | `pan` + `aecho` (Haas) | Mono → pseudo-stereo widening |
| **Reverb** | `aecho` or `firequalizer`+IR | Add hall/room character |
| **Master** | `loudnorm` | Normalize to target LUFS (-14 to -18) |

### Presets System

| Preset | Description | EQ Style | Reverb | Compression |
|--------|-------------|----------|--------|-------------|
| **Classical Hall** | Concert hall sound | Gentle, dynamics-preserving | 2500ms hall, 20% wet | Minimal (1.5:1, -2dB) |
| **Intimate Studio** | Close, warm | Presence boost, air | 800ms room, 15% wet | Light (2:1, -3dB) |
| **Bright Solo** | Clear, present | High shelf +4kHz | 1500ms hall, 18% wet | Normal (3:1, -4dB) |
| **Raw Clean** | Just cleanup | Only piezo quack removal | None (dry) | None |

## Tech Stack

- **Next.js 16** (App Router) — framework
- **FFmpeg.wasm** (@ffmpeg/ffmpeg) — in-browser audio processing
- **Tailwind CSS v4** — styling
- **TypeScript** — type safety

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Push to GitHub → connect to Vercel → deploy.

No serverless functions, no database, no external APIs needed.
Static site with client-side processing.

## Files

```
├── lib/
│   ├── presets.ts          # Preset definitions and config
│   ├── audio-processor.ts  # FFmpeg.wasm pipeline orchestration
│   └── audio-wavescanner.ts # Waveform visualization helpers
├── components/
│   ├── AudioUpload.tsx     # Drag & drop upload zone
│   ├── PresetSelector.tsx  # Preset cards with descriptions
│   ├── AudioPreview.tsx    # Before/after playback with A/B compare
│   └── ProcessingStatus.tsx # Progress indicator
├── app/
│   ├── layout.tsx
│   ├── page.tsx            # Main page
│   └── globals.css
├── public/
│   └── ffmpeg/             # FFmpeg.wasm core/wasm files (CDN loaded)
└── package.json
```

## FFmpeg.wasm Setup

FFmpeg.wasm v0.12 requires SharedArrayBuffer, which needs:
- HTTPS (Vercel provides this)
- COOP/COEP headers

In development, you may need to run with:
```bash
node server-with-headers.mjs
```

Or serve via Vercel (which handles headers automatically with `vercel.json` config).

## Studio Best Practices (Violin Solo)

Based on research from Sound on Sound, Gearspace, and professional mixing guides:

### EQ Guidelines for Pickup/DI Violin
- **High-pass**: 80-120 Hz (remove subsonic rumble)
- **Piezo quack cut**: 800-1200 Hz, narrow Q (2-4), -3 to -6 dB
- **Low-mid cleanup**: 200-400 Hz, gentle cut -2 dB
- **Presence**: 2-4 kHz, wide Q, +1 to +3 dB
- **Air**: 5-8 kHz shelf, +1 to +2 dB

### Compression Guidelines
- Classical: **minimal to none** — preserve dynamic markings
- General purpose: ratio 2:1-3:1, threshold -20dB, slow attack (200ms)
- Max gain reduction: 3-4 dB
- Fast enough attack to catch peaks, slow enough to preserve bow transients

### Stereo Widening from Mono
- Haas effect: delay one channel 10-30ms (careful with phase!)
- Always check mono compatibility
- Combine with subtle EQ difference between L/R channels
- Avoid simple dual-mono copy

### Reverb Guidelines
- Hall: 2000-2500ms decay, pre-delay 20-50ms, wet 15-25%
- Room: 500-1000ms decay, wet 10-15%
- Keep reverb natural — the worst mistake is overdoing it
- Pre-delay preserves attack clarity
