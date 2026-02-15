"use client";

import { useEffect, useState, useRef } from "react";
import type { GenerationPhase } from "@/lib/layertune-types";

interface GenerationOverlayProps {
  phase: GenerationPhase;
}

// Estimated durations for each phase (seconds)
const PHASE_ESTIMATES: Record<string, number> = {
  generating: 120, // ~2 min for Suno clip
  separating: 180, // ~3 min for stem separation
  loading: 5, // Quick audio load
};

const PHASE_MESSAGES: Record<string, { label: string; sub: string }> = {
  generating: {
    label: "Generating your track",
    sub: "Composing from your prompt — takes about a minute...",
  },
  loading: {
    label: "Loading audio",
    sub: "Rendering waveform...",
  },
  separating: {
    label: "Separating stems",
    sub: "Waveforms will appear as each stem completes...",
  },
};

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function WaveformAnimation({ barCount = 32 }: { barCount?: number }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-16" aria-hidden="true">
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          className="inline-block w-[3px] rounded-full bg-[#c4f567]"
          style={{
            animation: `waveBar 1.2s ease-in-out infinite`,
            animationDelay: `${(i * 0.06) % 1.2}s`,
            opacity: 0.4 + seededRandom(i) * 0.4,
          }}
        />
      ))}
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ProgressBar({ phase }: { phase: GenerationPhase }) {
  const steps = ["generating", "separating", "loading"] as const;
  const currentIdx = steps.indexOf(phase as (typeof steps)[number]);
  const [elapsed, setElapsed] = useState(0);
  const phaseStartRef = useRef(Date.now());

  // Reset timer when phase changes
  useEffect(() => {
    phaseStartRef.current = Date.now();
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - phaseStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const estimate = PHASE_ESTIMATES[phase] || 60;
  // Asymptotic progress: approaches 95% but never reaches 100%
  const phaseProgress = Math.min(0.95, 1 - Math.exp(-elapsed / (estimate * 0.5)));
  // Overall progress: combine completed phases + current phase progress
  const overallProgress = ((currentIdx + phaseProgress) / steps.length) * 100;

  return (
    <div className="w-full mt-5 space-y-2">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#c4f567] rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Step labels + elapsed */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {steps.map((step, i) => {
            const isActive = i === currentIdx;
            const isComplete = i < currentIdx;
            return (
              <span
                key={step}
                className={`text-[10px] uppercase tracking-wider ${
                  isActive
                    ? "text-[#c4f567] font-medium"
                    : isComplete
                    ? "text-[#c4f567]/50"
                    : "text-white/20"
                }`}
              >
                {step === "generating" ? "Generate" : step === "separating" ? "Stems" : "Load"}
              </span>
            );
          })}
        </div>
        <span className="text-[10px] text-white/30 font-mono tabular-nums">
          {formatElapsed(elapsed)}
        </span>
      </div>
    </div>
  );
}

export function GenerationOverlay({ phase }: GenerationOverlayProps) {
  const isActive =
    phase === "generating" || phase === "separating" || phase === "loading";
  const justCompleted = phase === "complete";
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const prevPhaseRef = useRef<GenerationPhase>("idle");

  useEffect(() => {
    if (isActive) {
      setVisible(true);
      setExiting(false);
    } else if (justCompleted && prevPhaseRef.current !== "idle" && prevPhaseRef.current !== "complete" && prevPhaseRef.current !== "error") {
      setExiting(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setExiting(false);
      }, 600);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setExiting(false);
    }
    prevPhaseRef.current = phase;
  }, [phase, isActive, justCompleted]);

  useEffect(() => {
    prevPhaseRef.current = phase;
  }, [phase]);

  if (!visible) return null;

  const msg = PHASE_MESSAGES[phase] || (exiting
    ? { label: "Ready", sub: "Your layers are loaded." }
    : { label: "Processing", sub: "Please wait..." });

  return (
    <div
      className={`absolute inset-0 z-[60] flex items-center justify-center transition-all duration-500 ${
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-500 ${
          exiting ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Card */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center px-8 py-8 rounded-2xl bg-[#111111]/90 border border-white/[0.07] shadow-2xl max-w-sm w-full mx-4 transition-all duration-500 ${
          exiting
            ? "opacity-0 scale-95 translate-y-4"
            : "opacity-100 scale-100 translate-y-0"
        }`}
      >
        {/* Waveform */}
        <WaveformAnimation barCount={28} />

        {/* Status label */}
        <p className="mt-4 text-base font-semibold text-white tracking-tight text-center">
          {msg.label}
        </p>
        <p className="mt-1 text-xs text-white/50 text-center leading-relaxed">
          {msg.sub}
        </p>

        {/* Progress bar with elapsed time */}
        <ProgressBar phase={phase} />
      </div>
    </div>
  );
}
