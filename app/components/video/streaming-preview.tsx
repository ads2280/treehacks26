"use client";

import { useEffect, useRef, useState } from "react";
import { getStreamingToken } from "@/lib/api";

interface StreamingPreviewProps {
  active: boolean;
}

export function StreamingPreview({ active }: StreamingPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!active) return;

    // Track avatar instance directly so cleanup always works,
    // even if component unmounts mid-initialization (RACE-001 fix)
    let avatarInstance: { stopAvatar: () => void } | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { token } = await getStreamingToken();
        if (cancelled) return;

        const {
          default: StreamingAvatar,
          AvatarQuality,
          StreamingEvents,
        } = await import("@heygen/streaming-avatar");
        const avatar = new StreamingAvatar({ token });
        avatarInstance = avatar;

        if (cancelled) {
          avatar.stopAvatar();
          return;
        }

        avatar.on(StreamingEvents.STREAM_READY, () => {
          if (cancelled) return;
          if (videoRef.current && avatar.mediaStream) {
            videoRef.current.srcObject = avatar.mediaStream;
            videoRef.current.play().catch(() => {
              // Autoplay may be blocked -- non-critical
            });
          }
          setConnected(true);
        });

        await avatar.createStartAvatar({
          quality: AvatarQuality.Medium,
          avatarName: "default",
        });

        if (cancelled) {
          avatar.stopAvatar();
        }
      } catch {
        // Graceful degradation -- streaming preview is optional
        console.warn("Streaming preview unavailable");
      }
    })();

    return () => {
      cancelled = true;
      avatarInstance?.stopAvatar();
      setConnected(false);
    };
  }, [active]);

  // Always render the container (Bug #5 -- never conditionally render a ref target)
  return (
    <div className={`${connected ? "" : "hidden"}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full rounded-lg"
      />
    </div>
  );
}

export default StreamingPreview;
