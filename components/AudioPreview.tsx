'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface AudioPreviewProps {
  originalUrl: string;
  processedUrl: string | null;
  originalFile: File | null;
  processedBlob: Blob | null;
}

type PlayMode = 'original' | 'processed' | 'compare';

export default function AudioPreview({ originalUrl, processedUrl, originalFile, processedBlob }: AudioPreviewProps) {
  const originalRef = useRef<HTMLAudioElement>(null);
  const processedRef = useRef<HTMLAudioElement>(null);
  const [playMode, setPlayMode] = useState<PlayMode>('original');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [compareSource, setCompareSource] = useState<'A' | 'B'>('A');
  const compareTimerRef = useRef<number | null>(null);

  const hasProcessed = !!processedUrl;

  // ─── helpers ──────────────────────────────

  const pauseAll = useCallback(() => {
    originalRef.current?.pause();
    processedRef.current?.pause();
    if (compareTimerRef.current) {
      clearTimeout(compareTimerRef.current);
      compareTimerRef.current = null;
    }
  }, []);

  const safePlay = useCallback((audio: HTMLAudioElement): Promise<boolean> => {
    return audio.play().then(() => true).catch(e => {
      console.warn('[player] play failed:', e.message);
      return false;
    });
  }, []);

  // ─── time tracking ────────────────────────

  useEffect(() => {
    const orig = originalRef.current;
    if (!orig || !originalUrl) return;
    const handleMeta = () => setDuration(orig.duration);
    orig.addEventListener('loadedmetadata', handleMeta);
    return () => orig.removeEventListener('loadedmetadata', handleMeta);
  }, [originalUrl]);

  useEffect(() => {
    // Interval-based time tracking (simpler than event-based, works for all modes)
    const id = setInterval(() => {
      if (playMode === 'compare') {
        const src = compareSource === 'A' ? originalRef.current : processedRef.current;
        if (src && !src.paused) setCurrentTime(src.currentTime);
      } else {
        const src = playMode === 'processed' ? processedRef.current : originalRef.current;
        if (src) setCurrentTime(src.currentTime);
      }
    }, 100);
    return () => clearInterval(id);
  }, [playMode, compareSource]);

  // ─── stop on mode change ──────────────────

  useEffect(() => {
    pauseAll();
    setIsPlaying(false);
  }, [playMode, pauseAll]);

  // ─── A/B compare loop ─────────────────────

  useEffect(() => {
    // This effect runs the A/B alternation loop
    if (playMode !== 'compare' || !isPlaying) return;

    const orig = originalRef.current;
    const proc = processedRef.current;
    if (!orig || !proc) return;

    let currentlyA = true;
    setCompareSource('A');

    const runSegment = async () => {
      const playing = currentlyA ? orig : proc;
      const pausing = currentlyA ? proc : orig;

      pausing.pause();
      // Sync position
      playing.currentTime = pausing.currentTime > 0.01 ? pausing.currentTime : 0;
      setCompareSource(currentlyA ? 'A' : 'B');

      const ok = await safePlay(playing);
      if (!ok) return; // stop loop if play fails

      compareTimerRef.current = window.setTimeout(() => {
        currentlyA = !currentlyA;
        runSegment();
      }, 3000);
    };

    // Start from 0
    orig.currentTime = 0;
    proc.currentTime = 0;
    setCurrentTime(0);
    runSegment();

    return () => {
      pauseAll();
    };
  }, [playMode, isPlaying, safePlay, pauseAll]);

  // ─── play/pause toggle ────────────────────

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      pauseAll();
      setIsPlaying(false);
      return;
    }

    if (playMode === 'compare') {
      // Just set isPlaying=true → the useEffect above starts the loop
      setIsPlaying(true);
      return;
    }

    // Normal mode
    const audio = playMode === 'processed' ? processedRef.current : originalRef.current;
    if (!audio) return;

    // Reset if at end
    if (audio.duration > 0 && audio.currentTime >= audio.duration - 0.1) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }

    const ok = await safePlay(audio);
    setIsPlaying(ok);
  }, [isPlaying, playMode, pauseAll, safePlay]);

  // ─── ended handler ────────────────────────

  useEffect(() => {
    const handleEnded = () => {
      pauseAll();
      setIsPlaying(false);
    };
    const orig = originalRef.current;
    const proc = processedRef.current;
    orig?.addEventListener('ended', handleEnded);
    proc?.addEventListener('ended', handleEnded);
    return () => {
      orig?.removeEventListener('ended', handleEnded);
      proc?.removeEventListener('ended', handleEnded);
    };
  }, [originalUrl, processedUrl, pauseAll]);

  // ─── seek ─────────────────────────────────

  const seekTo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (originalRef.current) originalRef.current.currentTime = time;
    if (processedRef.current) processedRef.current.currentTime = time;
  };

  const formatTime = (s: number) => {
    if (isNaN(s)) return '0:00';
    return Math.floor(s / 60) + ':' + Math.floor(s % 60).toString().padStart(2, '0');
  };

  // ─── download ─────────────────────────────

  const downloadProcessed = () => {
    if (!processedBlob || !processedUrl) return;
    const ext = processedBlob.type.includes('mp3') ? 'mp3' : 'wav';
    const name = originalFile?.name.replace(/\.[^.]+$/, '') || 'violin';
    const a = document.createElement('a');
    a.href = processedUrl;
    a.download = `${name}_polished.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!originalUrl) return null;

  const modeLabel = playMode === 'original' ? 'Originál'
    : playMode === 'processed' ? 'Vylepšená verze'
    : `A/B srovnání (${compareSource === 'A' ? 'Originál' : 'Vylepšená'})`;

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {originalUrl && <audio ref={originalRef} src={originalUrl} preload="auto" />}
      {processedUrl && <audio ref={processedRef} src={processedUrl} preload="auto" />}

      {hasProcessed && (
        <div className="join w-full">
          <button className={`join-item btn flex-1 ${playMode === 'original' ? 'btn-active' : ''}`} onClick={() => setPlayMode('original')}>Originál</button>
          <button className={`join-item btn flex-1 ${playMode === 'processed' ? 'btn-active' : ''}`} onClick={() => setPlayMode('processed')}>Vylepšená</button>
          <button className={`join-item btn flex-1 ${playMode === 'compare' ? 'btn-active' : ''}`} onClick={() => setPlayMode('compare')}>A/B srovnání</button>
        </div>
      )}

      <div className="text-center text-sm opacity-70">
        Přehrává se: <span className="font-semibold">{modeLabel}</span>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={togglePlay} className="btn btn-circle btn-primary btn-lg">
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs opacity-60 tabular-nums">{formatTime(currentTime)}</span>
          <input type="range" min={0} max={duration || 0} value={currentTime} onChange={seekTo} className="range range-xs flex-1" step="0.1" />
          <span className="text-xs opacity-60 tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>

      {hasProcessed && (
        <button onClick={downloadProcessed} className="btn btn-secondary w-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Stáhnout vylepšený zvuk
        </button>
      )}
    </div>
  );
}
