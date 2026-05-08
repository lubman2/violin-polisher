'use client';

import React, { useState, useRef, useCallback } from 'react';
import type { Preset } from '../lib/presets';
import { buildFFmpegCommand } from '../lib/audio-helpers';

// FFmpeg loaded at runtime from CDN — avoids Turbopack bundling entirely.
// We use single-threaded @ffmpeg/core (no worker needed).
declare global {
  interface Window {
    FFmpegWASM: {
      FFmpeg: new () => FFmpegInstance;
    };
    FFmpegUtil: {
      fetchFile: (file: string | File | Blob) => Promise<Uint8Array>;
      toBlobURL: (url: string, mimeType: string) => Promise<string>;
    };
  }
}

interface FFmpegInstance {
  load: (config: { coreURL: string; wasmURL: string }) => Promise<void>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  readFile: (path: string) => Promise<Uint8Array>;
  exec: (args: string[], timeout?: number) => Promise<number>;
  deleteFile: (path: string) => Promise<void>;
  on: (event: string, cb: (data: any) => void) => void;
}

// ESM CDN URLs — proper ES modules where import.meta.url works correctly
const FFMPEG_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm';
const FFMPEG_UTIL_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm';
const CORE_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

type Phase = 'init' | 'loading' | 'processing' | 'finalizing' | 'complete' | 'error' | 'idle';

interface ProcessingStatusProps {
  preset: Preset;
  inputFile: File;
  format: 'wav' | 'mp3';
  onComplete: (blob: Blob, url: string) => void;
  onError: (error: string) => void;
}

export default function ProcessingStatus({
  preset,
  inputFile,
  format,
  onComplete,
  onError,
}: ProcessingStatusProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ffmpegRef = useRef<FFmpegInstance | null>(null);
  const loadedRef = useRef(false);

  const loadFFmpeg = useCallback(async () => {
    if (loadedRef.current && ffmpegRef.current) {
      return { ffmpeg: ffmpegRef.current, fetchFile: window.FFmpegUtil?.fetchFile };
    }

    setPhase('init');
    setProgress(0);
    setMessage('Loading audio engine (~31 MB)...');

    const FFmpegClass = window.FFmpegWASM?.FFmpeg;
    const utilFetchFile = window.FFmpegUtil?.fetchFile;
    const utilToBlobURL = window.FFmpegUtil?.toBlobURL;

    if (!FFmpegClass || !utilFetchFile || !utilToBlobURL) {
      throw new Error('FFmpeg not loaded from CDN. Check network and COOP/COEP headers.');
    }

    const ffmpeg = new FFmpegClass();

    await ffmpeg.load({
      coreURL: await utilToBlobURL(`${CORE_CDN}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await utilToBlobURL(`${CORE_CDN}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    loadedRef.current = true;
    ffmpegRef.current = ffmpeg;
    return { ffmpeg, fetchFile: utilFetchFile };
  }, []);

  const process = useCallback(async () => {
    try {
      setError(null);
      setPhase('init');

      const { ffmpeg, fetchFile } = await loadFFmpeg();

      setPhase('loading');
      setProgress(0.2);
      setMessage('Loading audio file...');

      const inputExt = inputFile.name.split('.').pop()?.toLowerCase() || 'wav';
      const inputName = `input.${inputExt}`;
      const outputName = `output.${format}`;

      await ffmpeg.writeFile(inputName, await fetchFile(inputFile));

      setPhase('processing');
      setProgress(0);
      setMessage('Applying enhancements...');

      ffmpeg.on('progress', ({ progress: p }: { progress: number }) => {
        if (p > 0 && p <= 1) {
          setProgress(p);
          setMessage(`Processing... ${(p * 100).toFixed(0)}%`);
        }
      });

      ffmpeg.on('log', ({ message: logMsg }: { message: string }) => {
        console.log('[ffmpeg]', logMsg);
      });

      const args = buildFFmpegCommand(inputName, outputName, preset, format);
      console.log('FFmpeg args:', args.join(' '));

      await ffmpeg.exec(args, 300000);

      setPhase('finalizing');
      setProgress(0.9);
      setMessage('Finalizing...');

      const outputData = await ffmpeg.readFile(outputName);

      try { await ffmpeg.deleteFile(inputName); } catch {}
      try { await ffmpeg.deleteFile(outputName); } catch {}

      const buf = outputData as Uint8Array;
      const mimeType = format === 'wav' ? 'audio/wav' : 'audio/mp3';
      const blob = new Blob([new Uint8Array(buf)], { type: mimeType });
      const url = URL.createObjectURL(blob);

      setPhase('complete');
      setProgress(1);
      setMessage('Done!');

      onComplete(blob, url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Processing error:', msg);
      setError(msg);
      setPhase('error');
      onError(msg);
    }
  }, [loadFFmpeg, inputFile, format, preset, onComplete, onError]);

  const isRunning = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

  const phaseLabels: Record<string, string> = {
    idle: 'Ready to process',
    init: 'Loading audio engine...',
    loading: 'Loading audio file...',
    processing: 'Processing...',
    finalizing: 'Finalizing...',
    complete: 'Done!',
    error: 'Error',
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {phase !== 'idle' && (
        <div className="card bg-base-200/50 p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>{phaseLabels[phase] || 'Processing...'}</span>
              {phase !== 'error' && phase !== 'complete' && (
                <span className="opacity-70">{(progress * 100).toFixed(0)}%</span>
              )}
            </div>
            <progress
              className="progress progress-primary w-full"
              value={phase === 'complete' ? 1 : progress}
              max={1}
            />
          </div>

          {error && (
            <div className="mt-4 p-3 bg-error/10 rounded-lg text-sm text-error">
              <p className="font-semibold mb-1">Processing failed</p>
              <p className="opacity-80 font-mono text-xs break-all">{error}</p>
              <details className="mt-2">
                <summary className="text-xs opacity-60 cursor-pointer hover:opacity-100">Details</summary>
                <p className="mt-1 text-xs opacity-50">
                  FFmpeg is loaded from CDN at runtime. Check the browser console for errors.
                </p>
              </details>
            </div>
          )}
        </div>
      )}

      <button
        onClick={process}
        disabled={isRunning}
        className={`btn btn-primary btn-lg w-full ${isRunning ? 'loading' : ''}`}
      >
        {isRunning ? 'Processing...' : 'Polish My Recording'}
      </button>
    </div>
  );
}
