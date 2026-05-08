/**
 * Audio processing pipeline using FFmpeg.wasm
 * Builds FFmpeg filter chains from preset configs.
 * Processing runs on the client side via @ffmpeg/ffmpeg.
 */

import type { Preset } from './presets';

/**
 * Build FFmpeg filter chain string from a preset.
 * Returns the -af argument value.
 */
export function buildFilterChain(preset: Preset): string {
  const filters: string[] = [];

  // Phase 1: High-pass filter (remove rumble)
  if (preset.clean.highpassFreq) {
    filters.push('highpass=f=' + preset.clean.highpassFreq);
  }

  // Phase 2: EQ bands (piezo quack removal, presence boost)
  for (const band of preset.eq) {
    const widthParam = band.widthType === 'q'
      ? 'q=' + band.width
      : band.widthType + '=' + band.width;
    filters.push('equalizer=f=' + band.frequency + ':' + widthParam + ':g=' + band.gain);
  }

  // Phase 3: Noise reduction (afftdn)
  if (preset.clean.noiseReduction > 0) {
    filters.push('afftdn=nr=' + preset.clean.noiseReduction);
  }

  // Phase 4: Compression
  if (preset.compressor.enabled) {
    const comp = preset.compressor;
    const level = Math.pow(10, comp.threshold / 20);
    const makeup = Math.pow(10, comp.makeupGain / 20);
    const attackSec = comp.attack / 1000;
    const releaseSec = comp.release / 1000;
    filters.push(
      'acompressor=level_in=' + level +
      ':ratio=' + comp.ratio +
      ':attack=' + attackSec +
      ':release=' + releaseSec +
      ':level_out=' + makeup
    );
  }

  // Phase 5: Stereo widening (Haas effect) — mono to stereo
  if (preset.stereo.enabled) {
    const delayMs = preset.stereo.haasDelay * 1000;
    // Pan mono to stereo (both channels have same content), then delay right channel
    filters.push(
      'pan=stereo|FL=c0|FR=c0' +
      ',adelay=' + delayMs + '|' + delayMs + ':all=1'
    );
  }

  // Phase 6: Reverb via cascaded aecho
  if (preset.reverb.enabled) {
    const rev = preset.reverb;
    const delay = (rev.preDelay + rev.decay / 4) / 1000;
    const decay = rev.wetMix / 3;
    filters.push(
      'aecho=0.8:1:' + delay.toFixed(2) + ':' + decay.toFixed(2) +
      ',aecho=0.8:0.5:' + (delay + 0.05).toFixed(2) + ':' + (decay * 0.7).toFixed(2)
    );
  }

  // Phase 7: Loudness normalization
  const master = preset.master;
  filters.push('loudnorm=I=' + master.loudnessTarget + ':TP=' + master.truePeak + ':LRA=' + master.lra);

  return filters.join(',');
}

/**
 * Build full FFmpeg command arguments
 */
export function buildFFmpegCommand(inputFile: string, outputFile: string, preset: Preset, format: 'wav' | 'mp3'): string[] {
  const args: string[] = ['-i', inputFile];
  const filterChain = buildFilterChain(preset);
  args.push('-af', filterChain);

  if (format === 'mp3') {
    args.push('-b:a', '320k');
  }

  args.push('-y', outputFile);
  return args;
}
