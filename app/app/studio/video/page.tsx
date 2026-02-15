"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  parseLyricsIntoSections,
  generateInstrumentalSections,
} from "@/lib/lyrics-parser";
import type { LyricsSection } from "@/lib/lyrics-parser";
import {
  uploadToHeyGen,
  generateHeyGenVideo,
  pollHeyGenUntilDone,
  generateBackgrounds,
  uploadVideoToBlob,
  proxyAudioUrl,
  pollClips,
} from "@/lib/api";
import type {
  VideoGenerationPhase,
  VideoStyleConfig,
  VideoTheme,
} from "@/lib/layertune-types";
import { VIDEO_THEME_PROMPTS } from "@/lib/layertune-types";

// Dynamic imports for browser-only components
const CameraCapture = dynamic(
  () =>
    import("@/components/video/camera-capture").then((m) => m.CameraCapture),
  { ssr: false }
);

const StyleSelector = dynamic(
  () =>
    import("@/components/video/style-selector").then((m) => m.StyleSelector),
  { ssr: false }
);

const VideoGenerationOverlay = dynamic(
  () =>
    import("@/components/video/video-generation-overlay").then(
      (m) => m.VideoGenerationOverlay
    ),
  { ssr: false }
);

const VideoResult = dynamic(
  () => import("@/components/video/video-result").then((m) => m.VideoResult),
  { ssr: false }
);

const StreamingPreview = dynamic(
  () =>
    import("@/components/video/streaming-preview").then(
      (m) => m.StreamingPreview
    ),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "producething_project";

interface ProjectData {
  id: string;
  title: string;
  vibePrompt: string;
  duration: number;
  layers: { audioUrl: string | null; stemType: string }[];
  lyrics?: string;
  originalClipId: string | null;
}

type VideoStep = "capture" | "style" | "generating" | "result";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoPage() {
  const router = useRouter();

  // Step & phase
  const [step, setStep] = useState<VideoStep>("capture");
  const [phase, setPhase] = useState<VideoGenerationPhase>("idle");

  // Data
  const [project, setProject] = useState<ProjectData | null>(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  // Results
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Load project from localStorage on mount
  // -----------------------------------------------------------------------
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      router.replace("/studio");
      return;
    }
    try {
      const data = JSON.parse(raw) as ProjectData;
      if (!data.layers || data.layers.length === 0) {
        router.replace("/studio");
        return;
      }
      setProject(data);
    } catch {
      router.replace("/studio");
    }
  }, [router]);

  // -----------------------------------------------------------------------
  // Generation pipeline
  // -----------------------------------------------------------------------
  const handleStartGeneration = useCallback(
    async (styleConfig: VideoStyleConfig) => {
      if (!project || !selfieBlob) return;
      setStep("generating");
      setError(null);

      try {
        // 1. Parse lyrics into sections
        setPhase("parsing_lyrics");
        let sections: LyricsSection[];
        if (project.lyrics && project.lyrics.trim()) {
          sections = parseLyricsIntoSections(project.lyrics);
        } else {
          sections = generateInstrumentalSections(
            project.duration || 120,
            project.vibePrompt,
            "" // tags
          );
        }

        // 2. Generate backgrounds
        setPhase("generating_backgrounds");
        let themePrompt: string | null = null;
        if (styleConfig.mode === "preset" && styleConfig.theme) {
          themePrompt =
            VIDEO_THEME_PROMPTS[styleConfig.theme as VideoTheme];
        } else if (styleConfig.mode === "custom") {
          themePrompt = styleConfig.freeTextPrompt;
        }
        // For lyrics-driven and surprise, let the API generate from lyrics + vibePrompt

        const bgResult = await generateBackgrounds({
          sections: sections.map((s) => ({ tag: s.tag, lines: s.lines })),
          vibePrompt: project.vibePrompt,
          theme: themePrompt,
          tags: "", // derived from vibePrompt
        });

        // Merge background URLs back into sections
        for (
          let i = 0;
          i < sections.length && i < bgResult.sections.length;
          i++
        ) {
          sections[i].backgroundUrl = bgResult.sections[i].backgroundUrl;
        }

        // 3. Upload assets to HeyGen
        setPhase("uploading_assets");

        // Upload selfie as a talking photo (separate HeyGen endpoint)
        const photoResult = await uploadToHeyGen(selfieBlob, "image/jpeg", "talking_photo");

        // Upload song audio — prefer full mix from original clip over individual stems
        let audioUrl: string | null = null;

        if (project.originalClipId) {
          // Fetch original Suno clip to get full mix audio URL
          try {
            const clips = await pollClips([project.originalClipId]);
            const clip = clips.find((c) => c.audio_url);
            if (clip?.audio_url) audioUrl = clip.audio_url;
          } catch {
            // Fall through to layer audio
          }
        }

        if (!audioUrl) {
          // Fallback: use first layer's audio (single-stem project or clip fetch failed)
          const audioLayer = project.layers.find((l) => l.audioUrl);
          if (!audioLayer?.audioUrl) throw new Error("No audio found in project");
          audioUrl = audioLayer.audioUrl;
        }

        const audioProxyUrl = proxyAudioUrl(audioUrl);
        const audioResponse = await fetch(audioProxyUrl);
        const audioBlob = await audioResponse.blob();
        const audioResult = await uploadToHeyGen(audioBlob, "audio/mpeg");

        // Upload background images (graceful — single failure doesn't kill pipeline)
        await Promise.allSettled(
          sections
            .filter((s) => s.backgroundUrl)
            .map(async (s) => {
              try {
                const res = await fetch(s.backgroundUrl!);
                if (!res.ok) throw new Error(`Background fetch failed: ${res.status}`);
                const blob = await res.blob();
                const upload = await uploadToHeyGen(blob, "image/png");
                s.backgroundAssetId = upload.id;
              } catch (err) {
                console.warn(`Background upload failed for section ${s.tag}, skipping`, err);
              }
            })
        );

        // 4. Build video_inputs — single scene with full audio
        // HeyGen plays the full audio_asset from time 0 in every video_input,
        // so multiple scenes with the same audio would repeat the song N times.
        // Use one scene with the full song for correct lip-sync timing.
        setPhase("generating_video");
        const primaryBackground = sections.find((s) => s.backgroundAssetId);

        const videoInput: Record<string, unknown> = {
          character: {
            type: "talking_photo",
            talking_photo_id: photoResult.talking_photo_id || photoResult.image_key || photoResult.id,
          },
          voice: {
            type: "audio",
            audio_asset_id: audioResult.id,
          },
        };

        if (primaryBackground?.backgroundAssetId) {
          videoInput.background = {
            type: "image",
            image_asset_id: primaryBackground.backgroundAssetId,
          };
        }

        // Add lyrics text overlay from the first section with content
        if (project.lyrics) {
          const firstWithLines = sections.find((s) => s.lines.length > 0);
          if (firstWithLines) {
            const lyricsText = firstWithLines.lines
              .slice(0, 4)
              .map((line) => line.replace(/[<>&"']/g, ""))
              .join("\n");
            videoInput.text = {
              type: "text",
              text: lyricsText,
              font_size: 28,
              line_height: 1.2,
              color: "#FFFFFF",
              position: { x: 0.5, y: 0.85 },
              text_align: "center",
              width: 0.8,
            };
          }
        }

        const video_inputs = [videoInput];

        // 5. Generate video
        const genResult = await generateHeyGenVideo({ video_inputs });

        // 6. Poll until done
        setPhase("polling");
        const statusResult = await pollHeyGenUntilDone(genResult.video_id);

        // 7. Upload to Vercel Blob for shareable URL
        const videoResponse = await fetch(statusResult.video_url);
        const videoBlob = await videoResponse.blob();

        let blobUrl: string | undefined;
        try {
          const blobResult = await uploadVideoToBlob(
            videoBlob,
            `producething-video-${Date.now()}.mp4`
          );
          blobUrl = blobResult.url;
        } catch (e) {
          // Fall back to HeyGen URL if Blob upload fails
          console.warn("Blob upload failed, using HeyGen URL:", e);
        }

        setVideoUrl(statusResult.video_url);
        setShareUrl(blobUrl || statusResult.video_url);
        setThumbnailUrl(statusResult.thumbnail_url || null);
        setPhase("complete");

        // Wait for exit animation then switch to result
        setTimeout(() => setStep("result"), 800);
      } catch (err) {
        console.error("Video generation failed:", err);
        setError(
          err instanceof Error ? err.message : "Video generation failed"
        );
        setPhase("error");
      }
    },
    [project, selfieBlob]
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!project) return null; // Loading / redirecting

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-3 border-b border-white/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/studio")}
          className="text-white/60 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Studio
        </Button>
        <h1 className="text-sm font-medium text-white/80">
          Create Music Video
        </h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Step 1: Camera */}
        {step === "capture" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Take a Selfie</h2>
              <p className="text-white/50">
                Your face will become the singing avatar
              </p>
            </div>
            <CameraCapture
              onCapture={(blob: Blob) => {
                setSelfieBlob(blob);
                setSelfiePreview(URL.createObjectURL(blob));
                setStep("style");
              }}
            />
          </div>
        )}

        {/* Step 2: Style */}
        {step === "style" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Choose a Style</h2>
              <p className="text-white/50">
                How should your music video look?
              </p>
            </div>
            {selfiePreview && (
              <div className="flex justify-center">
                <img
                  src={selfiePreview}
                  alt="Your selfie"
                  className="w-24 h-24 rounded-full object-cover border-2 border-[#c4f567]/50"
                />
              </div>
            )}
            <StyleSelector
              onSubmit={handleStartGeneration}
              hasLyrics={!!(project.lyrics && project.lyrics.trim())}
            />
          </div>
        )}

        {/* Step 3: Generating */}
        {step === "generating" && (
          <div className="relative min-h-[400px] flex items-center justify-center">
            <VideoGenerationOverlay phase={phase} />
            {/* Streaming preview -- nice-to-have, degrades gracefully */}
            <StreamingPreview active={phase === "generating_video" || phase === "polling"} />
            {error && (
              <div className="text-center space-y-4 relative z-20">
                <p className="text-red-400">{error}</p>
                <Button
                  onClick={() => {
                    setStep("style");
                    setPhase("idle");
                    setError(null);
                  }}
                  className="bg-[#c4f567] text-black hover:bg-[#b3e456]"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Result */}
        {step === "result" && videoUrl && (
          <VideoResult
            videoUrl={videoUrl}
            shareUrl={shareUrl || undefined}
            thumbnailUrl={thumbnailUrl || undefined}
            onBack={() => router.push("/studio")}
          />
        )}
      </main>
    </div>
  );
}
