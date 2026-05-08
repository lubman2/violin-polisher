'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { Preset } from '../lib/presets';
import { buildFFmpegCommand } from '../lib/audio-helpers';

const CDN_BASE = 'https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/esm';

interface ProcessingStatusProps {
  preset: Preset;
  inputFile: File;
  format: 'wav' | 'mp3';
  onComplete: (blob: Blob, url: string) => void;
  onError: (error: string) => void;
}

type Phase = 'loading' | 'init' | 'processing' | 'finalizing' | 'complete' | 'error' | 'idle';

export default function ProcessingStatus({ preset, inputFile, format, onComplete, onError }: ProcessingStatusProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const loadedRef = useRef(false);

  const loadFFmpeg = async () => {
    if (loadedRef.current && ffmpegRef.current) return ffmpegRef.current;
    
    setPhase('init');
    setProgress(0);
    setMessage('Loading audio engine (~31 MB)...');
    
    const ffmpeg = new FFmpeg();
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CDN_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CDN_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${CDN_BASE}/ffmpeg-core.worker.js`, 'text/javascript'),
    });
    
    loadedRef.current = true;
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const process = async () => {
    try {
      setError(null);
      setPhase('init');
      
      const ffmpeg = await loadFFmpeg();
      
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

      // Progress tracking
      ffmpeg.on('progress', ({ progress: p }) => {
        if (p > 0 && p <= 1) {
          setProgress(p);
          setMessage(`Processing... ${(p * 100).toFixed(0)}%`);
        }
      });

      // Log output for debugging
      ffmpeg.on('log', ({ message: logMsg }) => {
        console.log('[ffmpeg]', logMsg);
      });

      // Build and execute filter chain
      const args = buildFFmpegCommand(inputName, outputName, preset, format);
      console.log('FFmpeg args:', args.join(' '));
      
      await ffmpeg.exec(args, 300000);

      setPhase('finalizing');
      setProgress(0.9);
      setMessage('Finalizing...');

      const outputData = await ffmpeg.readFile(outputName);
      
      // Cleanup
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
      
    } catch (err: any) {
      console.error('Processing error:', err);
      const errorMsg = err?.message || String(err);
      setError(errorMsg);
      setPhase('error');
      onError(errorMsg);
    }
  };

  const isRunning = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

  const phaseLabels: Record<string, string> = {
    idle: '⏳ Ready to process',
    init: '⏳ Loading audio engine...',
    loading: '⏳ Loading audio file...',
    processing: '⏳ Processing...',
    finalizing: '⏳ Finalizing...',
    complete: '✅ Done!',
    error: '❌ Error',
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
                  Make sure your browser supports SharedArrayBuffer (requires HTTPS and COOP/COEP headers).
                  On Vercel this is configured automatically via vercel.json.
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
        {isRunning ? 'Processing...' : 'Polish My Recording 🎻'}
      </button>
    </div>
  );
}
