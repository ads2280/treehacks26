"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
}

type CaptureState = "preview" | "captured" | "fallback";

export function CameraCapture({ onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [captureState, setCaptureState] = useState<CaptureState>("preview");
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Start camera stream
  const startCamera = useCallback(async () => {
    setIsInitializing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCaptureState("preview");
      setIsInitializing(false);
    } catch {
      // Permission denied or no camera — fall back to file input
      setCaptureState("fallback");
      setIsInitializing(false);
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Cleanup captured image URL on unmount
  useEffect(() => {
    return () => {
      if (capturedImageUrl) {
        URL.revokeObjectURL(capturedImageUrl);
      }
    };
  }, [capturedImageUrl]);

  // Capture frame from video
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Draw at the actual video resolution, capped at 720x720
    const size = Math.min(video.videoWidth, video.videoHeight, 720);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Center-crop to square
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        const url = URL.createObjectURL(blob);
        setCapturedImageUrl(url);
        setCaptureState("captured");
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  }, [stopCamera]);

  // Retake: clear captured image and restart camera
  const handleRetake = useCallback(() => {
    if (capturedImageUrl) {
      URL.revokeObjectURL(capturedImageUrl);
    }
    setCapturedImageUrl(null);
    setCapturedBlob(null);
    startCamera();
  }, [capturedImageUrl, startCamera]);

  // Continue: pass blob upstream
  const handleContinue = useCallback(() => {
    if (capturedBlob) {
      onCapture(capturedBlob);
    }
  }, [capturedBlob, onCapture]);

  // Fallback file input handler
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCapturedBlob(file);
      const url = URL.createObjectURL(file);
      setCapturedImageUrl(url);
      setCaptureState("captured");
    },
    []
  );

  // Drag-and-drop handlers for fallback
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setCapturedBlob(file);
      const url = URL.createObjectURL(file);
      setCapturedImageUrl(url);
      setCaptureState("captured");
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#111111] border border-white/[0.07] shadow-2xl">
        {/* Video preview — always rendered for ref stability (Bug #5 pattern) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${
            captureState === "preview" ? "block" : "hidden"
          }`}
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Captured image preview */}
        {captureState === "captured" && capturedImageUrl && (
          <img
            src={capturedImageUrl}
            alt="Captured selfie preview"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}

        {/* Fallback file upload */}
        {captureState === "fallback" && !capturedImageUrl && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 cursor-pointer hover:bg-white/[0.03] transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Upload a photo"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Upload className="w-7 h-7 text-white/40" />
            </div>
            <p className="text-sm text-white/50 text-center">
              Camera not available
            </p>
            <p className="text-xs text-white/30 text-center">
              Click or drag a photo here to upload
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Initializing spinner */}
        {isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#111111]">
            <div className="w-8 h-8 border-2 border-[#c4f567]/30 border-t-[#c4f567] rounded-full animate-spin" />
          </div>
        )}

        {/* Capture button overlay — only during live preview */}
        {captureState === "preview" && !isInitializing && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <button
              type="button"
              onClick={handleCapture}
              className="w-16 h-16 rounded-full bg-white/10 border-4 border-white/80 hover:border-[#c4f567] hover:bg-[#c4f567]/10 transition-all flex items-center justify-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c4f567]"
              aria-label="Take photo"
            >
              <Camera className="w-6 h-6 text-white group-hover:text-[#c4f567] transition-colors" />
            </button>
          </div>
        )}
      </div>

      {/* Action buttons below the viewfinder */}
      {captureState === "captured" && (
        <div className="flex items-center gap-3 w-full">
          <Button
            variant="outline"
            onClick={handleRetake}
            className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
          >
            <RotateCcw className="w-4 h-4" />
            Retake
          </Button>
          <Button
            onClick={handleContinue}
            className="flex-1 bg-[#c4f567] text-black hover:bg-[#b8e557] font-medium"
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}

export default CameraCapture;
