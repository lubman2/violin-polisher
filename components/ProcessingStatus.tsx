'use client';

import React, { useState, useRef, useCallback } from 'react';
import type { Preset } from '../lib/presets';
import { buildFFmpegCommand } from '../lib/audio-helpers';

// Direct WebWorker communication — no @ffmpeg/ffmpeg npm package needed.
// The worker is loaded from /ffmpeg/standalone-worker.js (same origin).

type Phase = 'init' | 'loading' | 'processing' | 'finalizing' | 'complete' | 'error' | 'idle';

const FFMPEG_CORE = '/ffmpeg/ffmpeg-core.js';
const FFMPEG_WASM = '/ffmpeg/ffmpeg-core.wasm';

interface ProcessingStatusProps {
  preset: Preset;
  inputFile: File;
  format: 'wav' | 'mp3';
  onComplete: (blob: Blob, url: string) => void;
  onError: (error: string) => void;
}

/**
 * Simple message-based FFmpeg worker wrapper.
 * Each message has an incrementing ID so we can match responses.
 */
class FFmpegWorkerClient {
  private worker: Worker;
  private nextId = 0;
  private listeners = new Map<number, (data: any, error?: string) => void>();
  private logCallback: ((msg: string) => void) | null = null;
  private progressCallback: ((p: number) => void) | null = null;

  constructor(workerPath: string) {
    this.worker = new Worker(workerPath, { type: 'classic' });
    this.worker.onmessage = ({ data }) => {
      const { id, type, data: result } = data;
      if (type === 'LOG') {
        this.logCallback?.(result);
        return;
      }
      if (type === 'PROGRESS') {
        this.progressCallback?.(result?.progress ?? 0);
        return;
      }
      if (type === 'ERROR') {
        const handler = this.listeners.get(id);
        if (handler) handler(null, data.data || 'Unknown error');
        return;
      }
      const handler = this.listeners.get(id);
      if (handler) handler(result ?? data);
    };
  }

  onLog(cb: (msg: string) => void) { this.logCallback = cb; }
  onProgress(cb: (p: number) => void) { this.progressCallback = cb; }

  private send<T>(type: string, data: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timeout = setTimeout(() => {
        this.listeners.delete(id);
        reject(new Error(`FFmpeg worker timeout for ${type}`));
      }, 300000);
      this.listeners.set(id, (result, error) => {
        clearTimeout(timeout);
        this.listeners.delete(id);
        if (error) reject(new Error(error));
        else resolve(result as T);
      });
      this.worker.postMessage({ id, type, data });
    });
  }

  async load() {
    return this.send<boolean>('LOAD', { coreURL: FFMPEG_CORE, wasmURL: FFMPEG_WASM });
  }

  async writeFile(path: string, data: Uint8Array) {
    return this.send<boolean>('WRITE_FILE', { path, data });
  }

  async exec(args: string[], timeout = -1) {
    return this.send<number>('EXEC', { args, timeout });
  }

  async readFile(path: string): Promise<Uint8Array> {
    return this.send('READ_FILE', { path, encoding: 'binary' });
  }

  async deleteFile(path: string) {
    try { await this.send('DELETE_FILE', { path }); } catch {}
  }

  terminate() {
    this.worker.terminate();
  }
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
  const ffmpegRef = useRef<FFmpegWorkerClient | null>(null);
  const loadedRef = useRef(false);

  const loadFFmpeg = useCallback(async () => {
    if (loadedRef.current && ffmpegRef.current) return ffmpegRef.current;

    setPhase('init');
    setProgress(0);
    setMessage('Loading audio engine (~31 MB)...');

    try {
      const client = new FFmpegWorkerClient('/ffmpeg/standalone-worker.js');
      await client.load();
      loadedRef.current = true;
      ffmpegRef.current = client;
      return client;
    } catch (e: unknown) {
      throw new Error(e instanceof Error ? e.message : 'Failed to load FFmpeg worker');
    }
  }, []);

  const process = useCallback(async () => {
    try {
      setError(null);
      setPhase('init');

      const ffmpeg = await loadFFmpeg();

      // Register callbacks for progress/logging
      ffmpeg.onProgress((p: number) => {
        if (p > 0 && p <= 1) {
          setProgress(p);
          setMessage(`Processing... ${(p * 100).toFixed(0)}%`);
        }
      });

      ffmpeg.onLog((logMsg: string) => {
        console.log('[ffmpeg]', logMsg);
      });

      setPhase('loading');
      setProgress(0.2);
      setMessage('Loading audio file...');

      const inputExt = inputFile.name.split('.').pop()?.toLowerCase() || 'wav';
      const inputName = `input.${inputExt}`;
      const outputName = `output.${format}`;

      // Read file as ArrayBuffer and convert to Uint8Array
      const arrayBuffer = await inputFile.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);
      await ffmpeg.writeFile(inputName, fileData);

      setPhase('processing');
      setProgress(0);
      setMessage('Applying enhancements...');

      const args = buildFFmpegCommand(inputName, outputName, preset, format);
      console.log('FFmpeg args:', args.join(' '));

      await ffmpeg.exec(args, 300000);

      setPhase('finalizing');
      setProgress(0.9);
      setMessage('Finalizing...');

      const outputData = await ffmpeg.readFile(outputName);

      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      const mimeType = format === 'wav' ? 'audio/wav' : 'audio/mp3';
      const blob = new Blob([new Uint8Array(outputData)], { type: mimeType });
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
                  Open browser console for more details.
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
