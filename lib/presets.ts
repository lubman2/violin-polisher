/**
 * Preset definitions for violin audio processing pipeline.
 * Each preset defines the full FFmpeg filter chain parameters.
 */

export interface EQBand {
  frequency: number;    // Hz
  gain: number;         // dB
  widthType: "h" | "o" | "q" | "k"; // h=Hz, o=octave, q=Q factor, k=kHz
  width: number;
}

export interface CompressorSettings {
  enabled: boolean;
  threshold: number;    // dB
  ratio: number;
  attack: number;       // ms
  release: number;      // ms
  makeupGain: number;   // dB
}

export interface ReverbSettings {
  enabled: boolean;
  type: "hall" | "room" | "plate" | "none";
  decay: number;        // ms
  preDelay: number;     // ms
  wetMix: number;       // 0-1
  dryMix: number;       // 0-1
}

export interface StereoSettings {
  enabled: boolean;
  type: "haas" | "chorus" | "dualEQ";
  haasDelay: number;    // ms, one channel delayed
  width: number;        // 0-1, stereo spread
}

export interface CleanSettings {
  highpassFreq: number;  // Hz
  lowpassFreq?: number;  // Hz
  noiseReduction: number; // dB (for afftdn)
}

export interface MasterSettings {
  loudnessTarget: number;  // LUFS (-14 for streaming, -18 for classical)
  truePeak: number;        // dBTP
  lra: number;             // Loudness Range
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  icon: string;
  eq: EQBand[];
  compressor: CompressorSettings;
  reverb: ReverbSettings;
  stereo: StereoSettings;
  clean: CleanSettings;
  master: MasterSettings;
}

/**
 * Classical Hall — concert hall character
 * Preserves dynamics, adds spacious hall reverb
 */
const classicalHall: Preset = {
  id: "classical-hall",
  name: "Classical Hall",
  description: "Koncertní síň. Jemná komprese zachovává dynamiku, prostorný hall reverb.",
  icon: "🏛️",
  eq: [
    { frequency: 80, gain: -12, widthType: "q", width: 0.7 },   // HP
    { frequency: 300, gain: -2,  widthType: "h", width: 500 },   // Low-mid cleanup
    { frequency: 900,  gain: -4,  widthType: "h", width: 400 },   // Piezo quack
    { frequency: 3000, gain: 2,   widthType: "h", width: 2000 },   // Presence
    { frequency: 7000, gain: 1.5, widthType: "k", width: 5 },     // Air shelf
  ],
  compressor: {
    enabled: true,
    threshold: -24,
    ratio: 1.5,
    attack: 300,
    release: 500,
    makeupGain: 1,
  },
  reverb: {
    enabled: true,
    type: "hall",
    decay: 2500,
    preDelay: 40,
    wetMix: 0.2,
    dryMix: 0.85,
  },
  stereo: {
    enabled: true,
    type: "haas",
    haasDelay: 15,
    width: 0.4,
  },
  clean: {
    highpassFreq: 80,
    noiseReduction: 20,
  },
  master: {
    loudnessTarget: -18,
    truePeak: -1,
    lra: 14,
  },
};

/**
 * Intimate Studio — warm, close, detailed
 */
const intimateStudio: Preset = {
  id: "intimate-studio",
  name: "Intimate Studio",
  description: "Teplý studiový zvuk. Přítomnost, jemný room reverb, lehká komprese.",
  icon: "🎙️",
  eq: [
    { frequency: 80, gain: -12, widthType: "q", width: 0.7 },
    { frequency: 250, gain: -2, widthType: "h", width: 400 },
    { frequency: 900, gain: -5, widthType: "h", width: 400 },
    { frequency: 3500, gain: 3, widthType: "h", width: 2000 },
    { frequency: 6000, gain: 2, widthType: "k", width: 5 },
  ],
  compressor: {
    enabled: true,
    threshold: -20,
    ratio: 2,
    attack: 200,
    release: 400,
    makeupGain: 2,
  },
  reverb: {
    enabled: true,
    type: "room",
    decay: 800,
    preDelay: 20,
    wetMix: 0.15,
    dryMix: 0.9,
  },
  stereo: {
    enabled: true,
    type: "haas",
    haasDelay: 10,
    width: 0.3,
  },
  clean: {
    highpassFreq: 80,
    noiseReduction: 24,
  },
  master: {
    loudnessTarget: -16,
    truePeak: -1,
    lra: 12,
  },
};

/**
 * Bright Solo — clear, present, modern
 */
const brightSolo: Preset = {
  id: "bright-solo",
  name: "Bright Solo",
  description: "Jasný, moderní zvuk. Silnější presence, hall reverb, výraznější komprese.",
  icon: "✨",
  eq: [
    { frequency: 80, gain: -12, widthType: "q", width: 0.7 },
    { frequency: 350, gain: -3, widthType: "h", width: 600 },
    { frequency: 1000, gain: -3, widthType: "h", width: 300 },
    { frequency: 4000, gain: 4, widthType: "h", width: 3000 },
    { frequency: 8000, gain: 2, widthType: "k", width: 5 },
  ],
  compressor: {
    enabled: true,
    threshold: -18,
    ratio: 3,
    attack: 200,
    release: 500,
    makeupGain: 3,
  },
  reverb: {
    enabled: true,
    type: "hall",
    decay: 1800,
    preDelay: 30,
    wetMix: 0.18,
    dryMix: 0.88,
  },
  stereo: {
    enabled: true,
    type: "haas",
    haasDelay: 12,
    width: 0.5,
  },
  clean: {
    highpassFreq: 80,
    noiseReduction: 22,
  },
  master: {
    loudnessTarget: -14,
    truePeak: -1,
    lra: 11,
  },
};

/**
 * Raw Clean — just fix the piezo quack, nothing else
 */
const rawClean: Preset = {
  id: "raw-clean",
  name: "Raw & Clean",
  description: "Jen vyčistit — odstranit piezo quack a šum. Žádný reverb, žádná komprese, surový zvuk.",
  icon: "🔧",
  eq: [
    { frequency: 80, gain: -12, widthType: "q", width: 0.7 },
    { frequency: 900, gain: -6, widthType: "h", width: 400 },
    { frequency: 600, gain: -2, widthType: "h", width: 500 },
  ],
  compressor: {
    enabled: false,
    threshold: -20,
    ratio: 1,
    attack: 200,
    release: 400,
    makeupGain: 0,
  },
  reverb: {
    enabled: false,
    type: "none",
    decay: 0,
    preDelay: 0,
    wetMix: 0,
    dryMix: 1,
  },
  stereo: {
    enabled: false,
    type: "haas",
    haasDelay: 0,
    width: 0,
  },
  clean: {
    highpassFreq: 80,
    noiseReduction: 24,
  },
  master: {
    loudnessTarget: -14,
    truePeak: -1,
    lra: 11,
  },
};

export const PRESETS: Preset[] = [
  classicalHall,
  intimateStudio,
  brightSolo,
  rawClean,
];

export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
