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
  const [compareLabel, setCompareLabel] = useState<'A' | 'B'>('A');
  const compareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false); // stable ref for async callbacks

  // Keep ref in sync with state
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Stop everything helper
  const stopAll = useCallback(() => {
    originalRef.current?.pause();
    processedRef.current?.pause();
    if (compareTimerRef.current) { clearTimeout(compareTimerRef.current); compareTimerRef.current = null; }
    setIsPlaying(false);
  }, []);

  // Track time & duration from original audio
  useEffect(() => {
    const audio = originalRef.current;
    if (!audio || !originalUrl) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => stopAll();
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => { audio.removeEventListener('timeupdate', onTime); audio.removeEventListener('loadedmetadata', onMeta); audio.removeEventListener('ended', onEnd); };
  }, [originalUrl, stopAll]);

  // Also track from processed if active
  useEffect(() => {
    const audio = processedRef.current;
    if (!audio || !processedUrl) return;
    const onTime = () => { if (playMode === 'processed' || playMode === 'compare') setCurrentTime(audio.currentTime); };
    const onMeta = () => { if (playMode === 'processed') setDuration(audio.duration); };
    const onEnd = () => stopAll();
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => { audio.removeEventListener('timeupdate', onTime); audio.removeEventListener('loadedmetadata', onMeta); audio.removeEventListener('ended', onEnd); };
  }, [processedUrl, playMode, stopAll]);

  // Stop on mode change
  useEffect(() => { stopAll(); }, [playMode, stopAll]);

  // A/B compare engine
  const startCompare = useCallback(() => {
    if (!originalRef.current || !processedRef.current) return;
    setIsPlaying(true);

    let playingA = true;
    setCompareLabel('A');

    const playNext = () => {
      if (!isPlayingRef.current) return;
      const toPlay = playingA ? originalRef.current : processedRef.current;
      const toPause = playingA ? processedRef.current : originalRef.current;
      if (!toPlay || !toPause) return;

      toPause.pause();
      // Sync position
      toPlay.currentTime = toPause.currentTime || currentTime;
      setCompareLabel(playingA ? 'A' : 'B');

      toPlay.play().catch(() => {});

      compareTimerRef.current = setTimeout(() => {
        playingA = !playingA;
        if (isPlayingRef.current) playNext();
      }, 3000);
    };

    // Start from current position
    originalRef.current.currentTime = currentTime;
    processedRef.current.currentTime = currentTime;
    playNext();
  }, [currentTime]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopAll();
      return;
    }

    if (playMode === 'compare') {
      startCompare();
      return;
    }

    const audio = playMode === 'processed' ? processedRef.current : originalRef.current;
    if (!audio) return;

    audio.play().then(() => {
      setIsPlaying(true);
    }).catch((e) => {
      console.warn('Audio play failed:', e.message);
      setIsPlaying(false);
    });
  }, [isPlaying, playMode, stopAll, startCompare]);

  const seekTo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (originalRef.current) originalRef.current.currentTime = time;
    if (processedRef.current) processedRef.current.currentTime = time;
  };

  const formatTime = (s: number) => {
    if (isNaN(s)) return '0:00';
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  const hasProcessed = !!processedUrl;

  const modeLabel = playMode === 'original' ? 'Originál'
    : playMode === 'processed' ? 'Vylepšená verze'
    : `A/B srovnání (${compareLabel === 'A' ? 'Originál' : 'Vylepšená'})`;

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Hidden audio elements */}
      {originalUrl && <audio ref={originalRef} src={originalUrl} preload="auto" />}
      {processedUrl && <audio ref={processedRef} src={processedUrl} preload="auto" />}

      {/* Playback mode toggle */}
      {hasProcessed && (
        <div className="join w-full">
          <button
            className={`join-item btn flex-1 ${playMode === 'original' ? 'btn-active' : ''}`}
            onClick={() => setPlayMode('original')}
          >
            Originál
          </button>
          <button
            className={`join-item btn flex-1 ${playMode === 'processed' ? 'btn-active' : ''}`}
            onClick={() => setPlayMode('processed')}
          >
            Vylepšená
          </button>
          <button
            className={`join-item btn flex-1 ${playMode === 'compare' ? 'btn-active' : ''}`}
            onClick={() => setPlayMode('compare')}
          >
            A/B srovnání
          </button>
        </div>
      )}

      {/* Now playing info */}
      <div className="text-center text-sm opacity-70">
        Přehrává se: <span className="font-semibold">{modeLabel}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="btn btn-circle btn-primary btn-lg"
        >
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
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={seekTo}
            className="range range-xs flex-1"
            step="0.1"
          />
          <span className="text-xs opacity-60 tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Download button */}
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
