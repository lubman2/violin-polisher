/**
 * Audio processing pipeline using FFmpeg.wasm
 * Builds FFmpeg filter chains from preset configs.
 * 
 * IMPORTANT: FFmpeg WASM (single-threaded, @ffmpeg/core 0.12.10) supports
 * only a subset of filters. Verified working:
 *   highpass, lowpass, equalizer, acompressor, pan, adelay, aecho, volume
 * NOT available in WASM:
 *   afftdn (needs libfftw3), loudnorm (needs libebur128), arnndn
 */

import type { Preset } from './presets';

/**
 * Build FFmpeg filter chain string from a preset.
 */
export function buildFilterChain(preset: Preset): string {
  const filters: string[] = [];

  // Phase 1: High-pass filter (remove rumble)
  if (preset.clean.highpassFreq) {
    filters.push('highpass=f=' + preset.clean.highpassFreq);
  }

  // Phase 2: EQ bands — use width_type=q (Q factor) which is universally supported
  for (const band of preset.eq) {
    // Convert all width types to Q factor for compatibility
    const q = band.widthType === 'q' ? band.width : 1.4;
    filters.push('equalizer=f=' + band.frequency + ':width_type=q:w=' + q + ':g=' + band.gain);
  }

  // Phase 3: Skip afftdn (not available in WASM build)
  // Using highpass + lowpass as basic noise reduction instead
  if (preset.clean.noiseReduction > 0) {
    // Low-pass at 16kHz to remove high-freq hiss
    filters.push('lowpass=f=16000');
  }

  // Phase 4: Compression
  if (preset.compressor.enabled) {
    const comp = preset.compressor;
    const attackSec = comp.attack / 1000;
    const releaseSec = comp.release / 1000;
    // acompressor threshold is in dB (negative), not linear
    filters.push(
      'acompressor=threshold=' + comp.threshold + 'dB' +
      ':ratio=' + comp.ratio +
      ':attack=' + attackSec +
      ':release=' + releaseSec +
      ':makeup=' + comp.makeupGain + 'dB'
    );
  }

  // Phase 5: Stereo widening (Haas effect) for mono input
  if (preset.stereo.enabled) {
    // haasDelay is in ms, adelay expects ms
    const delayMs = preset.stereo.haasDelay;
    // First duplicate mono to stereo, then delay right channel only
    filters.push('pan=stereo|FL=c0|FR=c0');
    filters.push('adelay=0|' + delayMs);
  }

  // Phase 6: Reverb via aecho (simple but works in WASM)
  if (preset.reverb.enabled) {
    const rev = preset.reverb;
    // aecho: in_gain|out_gain|delays(ms)|decays(0-1)
    const delayMs = Math.round(rev.preDelay + rev.decay * 0.3);
    const delayMs2 = Math.round(rev.preDelay + rev.decay * 0.6);
    const wet = rev.wetMix;
    filters.push(
      'aecho=' + (1 - wet).toFixed(2) + ':' + wet.toFixed(2) +
      ':' + delayMs + '|' + delayMs2 +
      ':' + (wet * 0.8).toFixed(2) + '|' + (wet * 0.5).toFixed(2)
    );
  }

  // Phase 7: Volume normalization (loudnorm NOT available in WASM, use volume + dynaudnorm)
  // dynaudnorm is a simpler alternative that IS available
  filters.push('dynaudnorm=p=0.9:s=5');

  return filters.join(',');
}

/**
 * Build full FFmpeg command arguments.
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
