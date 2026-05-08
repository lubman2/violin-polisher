'use client';

import { useState, useCallback } from 'react';
import AudioUpload from '../components/AudioUpload';
import PresetSelector from '../components/PresetSelector';
import AudioPreview from '../components/AudioPreview';
import ProcessingStatus from '../components/ProcessingStatus';
import { PRESETS, type Preset } from '../lib/presets';
import { APP_VERSION } from '../lib/version';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState('classical-hall');
  const [format, setFormat] = useState<'wav' | 'mp3'>('wav');
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);

  const handleFileSelect = useCallback((file: File, url: string) => {
    // Clean up old URL
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setSelectedFile(file);
    setFileUrl(url);
    setProcessedUrl(null);
    setProcessedBlob(null);
  }, [fileUrl]);

  const handleProcessingComplete = useCallback((blob: Blob, url: string) => {
    setProcessedBlob(blob);
    setProcessedUrl(url);
  }, []);

  const handleProcessingError = useCallback((error: string) => {
    console.error('Processing error:', error);
  }, []);

  const selectedPreset = PRESETS.find(p => p.id === selectedPresetId) || PRESETS[0];

  return (
    <div className="min-h-screen bg-base-200">
      <header className="bg-base-100 border-b border-base-content/5 py-6">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🎻</span>
            <div>
              <h1 className="text-2xl font-bold flex items-baseline gap-2">
                Violin Polisher
                <span className="text-xs opacity-40 font-normal tabular-nums">v{APP_VERSION}</span>
              </h1>
              <p className="text-sm opacity-60">Transform raw pickup recordings into polished audio</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {/* Step 1: Upload */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-content text-sm font-bold">1</span>
            Upload Recording
          </h2>
          <AudioUpload
            selectedFile={selectedFile}
            fileUrl={fileUrl}
            onFileSelect={handleFileSelect}
          />
        </section>

        {/* Step 2: Choose preset */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-content text-sm font-bold">2</span>
            Choose Tone
          </h2>
          <PresetSelector
            presets={PRESETS}
            selectedId={selectedPresetId}
            onSelect={setSelectedPresetId}
          />
        </section>

        {/* Step 3: Format */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-content text-sm font-bold">3</span>
            Output Format
          </h2>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="wav"
                checked={format === 'wav'}
                onChange={() => setFormat('wav')}
                className="radio radio-primary"
              />
              <span>WAV (lossless)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="mp3"
                checked={format === 'mp3'}
                onChange={() => setFormat('mp3')}
                className="radio radio-primary"
              />
              <span>MP3 (320kbps)</span>
            </label>
          </div>
        </section>

        {/* Step 4: Process */}
        {selectedFile && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-content text-sm font-bold">4</span>
              Process & Download
            </h2>
            <ProcessingStatus
              key={`${selectedFile.name}-${selectedPresetId}-${format}`}
              preset={selectedPreset}
              inputFile={selectedFile}
              format={format}
              onComplete={handleProcessingComplete}
              onError={handleProcessingError}
            />
          </section>
        )}

        {/* Preview */}
        {(fileUrl || processedUrl) && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-content text-sm font-bold">♪</span>
              Preview
            </h2>
            <AudioPreview
              originalUrl={fileUrl || ''}
              processedUrl={processedUrl}
              originalFile={selectedFile}
              processedBlob={processedBlob}
            />
          </section>
        )}

        {/* How it works */}
        <section className="mt-16 mb-8">
          <div className="bg-base-100 rounded-2xl p-6">
            <h3 className="font-semibold text-lg mb-4">How it works</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium">🧹 Clean</h4>
                <p className="opacity-70">Removes hum, hiss, and rumble using AI noise reduction (RNNoise).</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">🎛 Equalize</h4>
                <p className="opacity-70">Fixes piezo "quack" and boosts presence + air frequencies for natural tone.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">📊 Compress</h4>
                <p className="opacity-70">Smooths dynamics gently — preserves bow transients and musical expression.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">🔊 Stereo + Reverb</h4>
                <p className="opacity-70">Adds stereo width (Haas effect) and natural hall reverb for spatial depth.</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-base-200 rounded-lg">
              <p className="text-xs opacity-60">
                🔄 All processing runs locally in your browser using FFmpeg.wasm. Your audio never leaves your device — no upload to any server.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
