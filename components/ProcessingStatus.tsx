'use client';

import React, { useState, useRef, useCallback } from 'react';
import type { Preset } from '../lib/presets';
import { buildFFmpegCommand } from '../lib/audio-helpers';

// ─── FFmpeg Worker Client ──────────────────────────────────────────

class FFmpegWorkerClient {
  private worker: Worker;
  private nextId = 0;
  private listeners = new Map<number, (data: unknown, error?: string) => void>();
  private logCallback: ((msg: string) => void) | null = null;
  private progressCallback: ((p: number) => void) | null = null;

  constructor(workerPath: string) {
    this.worker = new Worker(workerPath, { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      const { id, type, data: result } = data as { id: number; type: string; data?: unknown };
      if (type === 'LOG') { this.logCallback?.(String(result)); return; }
      if (type === 'PROGRESS') { this.progressCallback?.((result as any)?.progress ?? 0); return; }
      if (type === 'ERROR') {
        const handler = this.listeners.get(id);
        if (handler) handler(null, String(data.data || 'Unknown error'));
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
      this.listeners.set(id, (result, err) => { clearTimeout(timeout); this.listeners.delete(id); if (err) reject(new Error(err)); else resolve(result as T); });
      this.worker.postMessage({ id, type, data });
    });
  }

  async load() { return this.send<boolean>('LOAD', { coreURL: 'https://esm.sh/@ffmpeg/core@0.12.10', wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm' }); }
  async writeFile(path: string, data: Uint8Array) { return this.send<boolean>('WRITE_FILE', { path, data }); }
  async exec(args: string[], timeout = -1) { return this.send<number>('EXEC', { args, timeout }); }
  async readFile(path: string): Promise<Uint8Array> { return this.send('READ_FILE', { path, encoding: 'binary' }); }
  async deleteFile(path: string) { try { await this.send<boolean>('DELETE_FILE', { path }); } catch {} }
  async listFiles() { return this.send('LIST_FILES', {}); }
  async getLogs() { return this.send('GET_LOGS', {}); }
  terminate() { this.worker.terminate(); }
}

// ─── Component ─────────────────────────────────────────────────────

type Phase = 'init' | 'loading' | 'processing' | 'finalizing' | 'complete' | 'error' | 'idle';

const phaseLabels: Record<string, string> = {
  idle: 'Připraveno ke zpracování',
  init: 'Načítání zvukového enginu...',
  loading: 'Načítání souboru...',
  processing: 'Zpracovávám...',
  finalizing: 'Dokončuji...',
  complete: 'Hotovo!',
  error: 'Chyba',
};

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
  const ffmpegRef = useRef<FFmpegWorkerClient | null>(null);
  const loadedRef = useRef(false);

  const loadFFmpeg = useCallback(async () => {
    if (loadedRef.current && ffmpegRef.current) return ffmpegRef.current;

    setPhase('init');
    setProgress(0);
    setMessage('Načítání zvukového enginu (~31 MB)...');

    const client = new FFmpegWorkerClient('/ffmpeg/standalone-worker.js');
    await client.load();
    loadedRef.current = true;
    ffmpegRef.current = client;
    return client;
  }, []);

  const process = useCallback(async () => {
    try {
      setError(null);
      setPhase('init');

      const ffmpeg = await loadFFmpeg();

      ffmpeg.onProgress((p: number) => {
        if (p > 0 && p <= 1) { setProgress(p); setMessage(`Zpracovávám... ${(p * 100).toFixed(0)} %`); }
      });

      ffmpeg.onLog((m: string) => {
        // FFmpeg logger sends objects with {type, message}, not plain strings
        const text = typeof m === 'object' ? JSON.stringify(m) : String(m);
        console.log('[ffmpeg]', text);
      });

      setPhase('loading');
      setProgress(0.2);
      setMessage('Načítání souboru...');

      const inputExt = inputFile.name.split('.').pop()?.toLowerCase() || 'wav';
      const inputName = `input.${inputExt}`;
      const outputName = `output.${format}`;

      await ffmpeg.writeFile(inputName, new Uint8Array(await inputFile.arrayBuffer()));

      setPhase('processing');
      setProgress(0);
      setMessage('Aplikuji vylepšení...');

      const args = buildFFmpegCommand(inputName, outputName, preset, format);
      console.log('FFmpeg args:', args.join(' '));

      // Trace: file listing before exec
      const beforeFiles = await ffmpeg.listFiles();
      console.log('[trace] files before exec:', JSON.stringify(beforeFiles));

      const execRet = await ffmpeg.exec(args, 300000);
      console.log('[trace] exec return code:', execRet);

      // Trace: worker logs
      const workerLogs = await ffmpeg.getLogs() as unknown[];
      console.log('[trace] worker logs:', JSON.stringify(workerLogs?.slice?.(-10) ?? workerLogs));

      // Trace: file listing after exec
      const afterFiles = await ffmpeg.listFiles();
      console.log('[trace] files after exec:', JSON.stringify(afterFiles));

      setPhase('finalizing');
      setProgress(0.9);
      setMessage('Dokončuji...');

      const outputData = await ffmpeg.readFile(outputName);
      console.log('[trace] outputData byteLength:', outputData?.byteLength ?? 'null');
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      const mimeType = format === 'wav' ? 'audio/wav' : 'audio/mp3';
      const blob = new Blob([new Uint8Array(outputData)], { type: mimeType });
      const url = URL.createObjectURL(blob);

      setPhase('complete');
      setProgress(1);
      setMessage('Hotovo!');
      onComplete(blob, url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Chyba zpracování:', msg);
      setError(msg);
      setPhase('error');
      onError(msg);
    }
  }, [loadFFmpeg, inputFile, format, preset, onComplete, onError]);

  const isRunning = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {phase !== 'idle' && (
        <div className="card bg-base-200/50 p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>{phaseLabels[phase] || 'Zpracovávám...'}</span>
              {phase !== 'error' && phase !== 'complete' && (
                <span className="opacity-70">{(progress * 100).toFixed(0)} %</span>
              )}
            </div>
            <progress className="progress progress-primary w-full" value={phase === 'complete' ? 1 : progress} max={1} />
          </div>

          {error && (
            <div className="mt-4 p-3 bg-error/10 rounded-lg text-sm text-error">
              <p className="font-semibold mb-1">Zpracování selhalo</p>
              <p className="opacity-80 font-mono text-xs break-all">{error}</p>
              <details className="mt-2">
                <summary className="text-xs opacity-60 cursor-pointer hover:opacity-100">Detaily</summary>
                <p className="mt-1 text-xs opacity-50">Otevřete konzoli prohlížeče pro více informací.</p>
              </details>
            </div>
          )}
        </div>
      )}

      <button onClick={process} disabled={isRunning} className={`btn btn-primary btn-lg w-full ${isRunning ? 'loading' : ''}`}>
        {isRunning ? 'Zpracovávám...' : 'Vylepšit nahrávku 🎻'}
      </button>
    </div>
  );
}
