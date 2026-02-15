"use client";

import { useState, useCallback } from "react";
import { Download, Copy, Share2, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadUrl } from "@/lib/audio-utils";

interface VideoResultProps {
  videoUrl: string;
  shareUrl?: string;
  thumbnailUrl?: string;
  onBack: () => void;
}

export function VideoResult({
  videoUrl,
  shareUrl,
  thumbnailUrl,
  onBack,
}: VideoResultProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      await downloadUrl(videoUrl, "music-video.mp4");
    } finally {
      setIsDownloading(false);
    }
  }, [videoUrl]);

  const handleCopyLink = useCallback(async () => {
    const url = shareUrl || videoUrl;
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback: select from a temporary input
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }, [shareUrl, videoUrl]);

  const handleShareTwitter = useCallback(() => {
    const url = shareUrl || videoUrl;
    const text = encodeURIComponent(
      "Check out this music video I made with ProduceThing! 🎵🎬"
    );
    const tweetUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
  }, [shareUrl, videoUrl]);

  const displayUrl = shareUrl || videoUrl;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
      {/* Video player */}
      <div className="w-full rounded-2xl overflow-hidden bg-[#111111] border border-white/[0.07] shadow-2xl">
        <video
          src={videoUrl}
          controls
          poster={thumbnailUrl}
          className="w-full aspect-video bg-black"
          preload="metadata"
        >
          <track kind="captions" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 w-full">
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          className="bg-[#c4f567] text-black font-medium hover:bg-[#b8e557] disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isDownloading ? "Downloading..." : "Download MP4"}
        </Button>

        <Button
          variant="outline"
          onClick={handleShareTwitter}
          className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
        >
          <Share2 className="w-4 h-4" />
          Share on X
        </Button>
      </div>

      {/* Shareable URL section */}
      {displayUrl && (
        <div className="w-full rounded-xl bg-white/[0.03] border border-white/[0.07] p-4 space-y-2">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
            Shareable Link
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 overflow-hidden">
              <p className="text-sm text-white/60 truncate font-mono">
                {displayUrl}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              className="shrink-0 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              aria-label={isCopied ? "Link copied" : "Copy link"}
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-[#c4f567]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Back to studio */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="text-white/40 hover:text-white hover:bg-white/5"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Studio
      </Button>
    </div>
  );
}

export default VideoResult;
