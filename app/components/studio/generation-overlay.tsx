"use client";

import { useEffect, useState, useRef } from "react";
import type { GenerationPhase } from "@/lib/layertune-types";

interface GenerationOverlayProps {
  phase: GenerationPhase;
}

const PHASE_MESSAGES: Record<string, { label: string; sub: string }> = {
  generating: {
    label: "Generating your track",
    sub: "Composing layers from your prompt...",
  },
  separating: {
    label: "Separating stems",
    sub: "Isolating individual instruments...",
  },
  loading: {
    label: "Loading audio",
    sub: "Preparing waveforms for editing...",
  },
};

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function WaveformAnimation({ barCount = 32 }: { barCount?: number }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-20" aria-hidden="true">
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

function ProgressDots({ phase }: { phase: GenerationPhase }) {
  const steps = ["generating", "separating", "loading"];
  const currentIdx = steps.indexOf(phase);

  return (
    <div className="flex items-center gap-2 mt-5">
      {steps.map((step, i) => {
        const isActive = i === currentIdx;
        const isComplete = i < currentIdx;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                isActive
                  ? "bg-[#c4f567] scale-125 shadow-[0_0_8px_rgba(196,245,103,0.6)]"
                  : isComplete
                  ? "bg-[#c4f567]/60"
                  : "bg-white/15"
              }`}
            />
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-px transition-colors duration-500 ${
                  isComplete ? "bg-[#c4f567]/40" : "bg-white/10"
                }`}
              />
            )}
          </div>
        );
      })}
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
      // Phase just switched to "complete" -- start exit animation
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

  // Keep prevPhaseRef updated even if not in effect cleanup
  useEffect(() => {
    prevPhaseRef.current = phase;
  }, [phase]);

  if (!visible) return null;

  const msg = PHASE_MESSAGES[phase] || (exiting
    ? { label: "Ready", sub: "Your layers are loaded." }
    : { label: "Processing", sub: "Please wait..." });

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center transition-all duration-500 ${
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-500 ${
          exiting ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Card */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center px-10 py-10 rounded-2xl bg-[#111111]/90 border border-white/[0.07] shadow-2xl max-w-md w-full mx-4 transition-all duration-500 ${
          exiting
            ? "opacity-0 scale-95 translate-y-4"
            : "opacity-100 scale-100 translate-y-0"
        }`}
      >
        {/* Waveform */}
        <div className="flex items-center justify-center w-full">
          <WaveformAnimation barCount={36} />
        </div>

        {/* Status label */}
        <p className="mt-6 text-lg font-semibold text-white tracking-tight text-center w-full">
          {msg.label}
        </p>
        <p className="mt-1.5 text-sm text-white/50 text-center leading-relaxed w-full">
          {msg.sub}
        </p>

        {/* Step dots */}
        <div className="flex items-center justify-center w-full">
          <ProgressDots phase={phase} />
        </div>
      </div>

    </div>
  );
}
