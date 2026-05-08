import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Violin Polisher — Clean & Enhance Your Recordings",
  description: "Transform raw violin pickup recordings into polished studio-quality audio. EQ, compression, stereo widening, and reverb — all in your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        { /* Load FFmpeg.wasm from CDN as ESM — exposes window.FFmpegWASM and window.FFmpegUtil */ }
        { /* Must load BEFORE React to avoid Turbopack bundling issues with FFmpeg's WebWorker code */ }
        <Script
          id="ffmpeg-loader"
          strategy="beforeInteractive"
        >{`
          (async function() {
            try {
              // Import FFmpeg core module
              const ffmpeg = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm');
              window.FFmpegWASM = ffmpeg;
            } catch(e) {
              console.error('FFmpeg core load failed:', e);
            }

            try {
              // Import FFmpeg utilities
              const util = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm');
              window.FFmpegUtil = util;
            } catch(e) {
              console.error('FFmpeg util load failed:', e);
            }
          })();
        `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
