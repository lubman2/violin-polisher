import React, { useCallback, useState, useRef } from 'react';

interface AudioUploadProps {
  onFileSelect: (file: File, url: string) => void;
  selectedFile: File | null;
  fileUrl: string | null;
}

export default function AudioUpload({ onFileSelect, selectedFile, fileUrl }: AudioUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file (WAV, MP3, etc.)');
      return;
    }
    const url = URL.createObjectURL(file);
    onFileSelect(file, url);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer hover:bg-white/5 ${
          isDragging ? 'border-accent bg-white/10 scale-[1.02]' : 'border-base-content/20 hover:border-base-content/40'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload audio file"
      >
        {selectedFile ? (
          <div className="space-y-3">
            <div className="text-4xl">🎵</div>
            <div>
              <p className="font-semibold text-lg">{selectedFile.name}</p>
              <p className="text-sm opacity-70">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (fileUrl) URL.revokeObjectURL(fileUrl);
                onFileSelect(null as unknown as File, null as unknown as string);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="btn btn-sm btn-ghost mt-2"
            >
              Remove & Choose Another
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-4xl">🎻</div>
            <div>
              <p className="font-semibold text-lg">Drop your violin recording here</p>
              <p className="text-sm opacity-70">or click to browse</p>
            </div>
            <p className="text-xs opacity-50">Supports WAV, MP3, FLAC, OGG</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          onChange={handleChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
