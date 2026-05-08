'use client';

import React, { useRef, useState, useEffect } from 'react';

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
  const compareIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine which audio element to use for UI state
  const activeRef = playMode === 'processed' ? processedRef : originalRef;

  useEffect(() => {
    const audio = activeRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [activeRef, playMode]);

  // Compare mode: alternate between original and processed every 3 seconds
  useEffect(() => {
    if (playMode === 'compare') {
      let isOriginal = true;
      if (originalRef.current) originalRef.current.pause();
      if (processedRef.current) processedRef.current.pause();

      const playSegment = () => {
        if (isOriginal && originalRef.current) {
          originalRef.current.currentTime = currentTime;
          originalRef.current.play();
        } else if (!isOriginal && processedRef.current) {
          processedRef.current.currentTime = currentTime;
          processedRef.current.play();
        }

        // Stop after 3 seconds and switch
        setTimeout(() => {
          if (originalRef.current) originalRef.current.pause();
          if (processedRef.current) processedRef.current.pause();
          isOriginal = !isOriginal;
          if (isPlaying) playSegment(); // Continue if still playing
          else setIsPlaying(false);
        }, 3000);
      };

      if (isPlaying) playSegment();

      return () => {
        if (originalRef.current) originalRef.current.pause();
        if (processedRef.current) processedRef.current.pause();
      };
    }
  }, [playMode, isPlaying, currentTime]);

  const togglePlay = () => {
    const audio = activeRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

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

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Hidden audio elements */}
      <audio ref={originalRef} src={originalUrl} preload="auto" />
      {processedUrl && <audio ref={processedRef} src={processedUrl} preload="auto" />}

      {/* Playback mode toggle */}
      {processedUrl && (
        <div className="join w-full">
          <button
            className={`join-item btn flex-1 ${playMode === 'original' ? 'btn-active' : ''}`}
            onClick={() => setPlayMode('original')}
          >
            Original
          </button>
          <button
            className={`join-item btn flex-1 ${playMode === 'processed' ? 'btn-active' : ''}`}
            onClick={() => setPlayMode('processed')}
          >
            Processed
          </button>
          <button
            className={`join-item btn flex-1 ${playMode === 'compare' ? 'btn-active' : ''}`}
            onClick={() => setPlayMode('compare')}
          >
            A/B Compare
          </button>
        </div>
      )}

      {/* Now playing info */}
      <div className="text-center text-sm opacity-70">
        Now playing: <span className="font-semibold">
          {playMode === 'original' ? 'Original Recording' :
           playMode === 'processed' ? 'Polished Version' :
           'A/B Compare (3s alternation)'}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="btn btn-circle btn-primary btn-lg"
          disabled={playMode === 'compare'}
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
      {processedUrl && (
        <button onClick={downloadProcessed} className="btn btn-secondary w-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download Polished Audio
        </button>
      )}
    </div>
  );
}
