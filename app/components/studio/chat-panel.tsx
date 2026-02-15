"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { Send, User, Loader2 } from "lucide-react";
import { DjHead } from "@/components/icons/dj-head";
import { Button } from "@/components/ui/button";
import { SMART_SUGGESTIONS, STEM_COLORS } from "@/lib/layertune-types";
import type { StemType, Project } from "@/lib/layertune-types";

interface ChatPanelProps {
  project: Project;
  isGenerating: boolean;
  hasLayers: boolean;
  onGenerateTrack: (
    topic: string,
    tags: string,
    instrumental: boolean,
    options?: { negative_tags?: string; lyrics?: string }
  ) => void;
  onAddLayer: (stemType: StemType, tags: string) => void;
  onRegenerateLayer: (layerId: string, description: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onSetLyrics: (lyrics: string) => void;
}

export function ChatPanel({
  project,
  isGenerating,
  hasLayers,
  onGenerateTrack,
  onAddLayer,
  onRegenerateLayer,
  onRemoveLayer,
  onSetLyrics,
}: ChatPanelProps) {
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [targetLayer, setTargetLayer] = useState<{ id: string; name: string; stemType: StemType } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { messages, sendMessage, addToolOutput, error, regenerate, status } =
    useChat({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      async onToolCall({ toolCall }) {
        const p = projectRef.current;
        let output = "Done";

        switch (toolCall.toolName) {
          case "generate_track": {
            const args = toolCall.input as {
              topic: string;
              tags: string;
              make_instrumental?: boolean;
              negative_tags?: string;
              lyrics?: string;
            };
            onGenerateTrack(args.topic, args.tags, !!args.make_instrumental, {
              negative_tags: args.negative_tags,
              lyrics: args.lyrics,
            });
            output = `Started generating track: "${args.topic}" with tags: ${args.tags}`;
            break;
          }
          case "add_layer": {
            const args = toolCall.input as {
              stemType: StemType;
              tags?: string;
              topic?: string;
            };
            onAddLayer(args.stemType, args.tags || args.topic || "");
            output = `Adding ${args.stemType} layer`;
            break;
          }
          case "regenerate_layer": {
            const args = toolCall.input as {
              layerId: string;
              newDescription: string;
            };
            onRegenerateLayer(args.layerId, args.newDescription);
            output = `Regenerating layer with: "${args.newDescription}"`;
            break;
          }
          case "remove_layer": {
            const args = toolCall.input as { layerId: string };
            onRemoveLayer(args.layerId);
            output = `Removed layer ${args.layerId}`;
            break;
          }
          case "set_lyrics": {
            const args = toolCall.input as { lyrics: string };
            onSetLyrics(args.lyrics);
            output = "Lyrics updated";
            break;
          }
          case "get_composition_state": {
            const state = {
              title: p.title,
              vibePrompt: p.vibePrompt,
              layerCount: p.layers.length,
              layers: p.layers.map((l) => ({
                id: l.id,
                name: l.name,
                stemType: l.stemType,
                isMuted: l.isMuted,
                isSoloed: l.isSoloed,
                volume: l.volume,
              })),
              cachedStems: p.stemCache.map((s) => s.stemType),
              hasOriginalClip: !!p.originalClipId,
            };
            output = JSON.stringify(state);
            break;
          }
        }

        // Explicitly provide tool result via addToolOutput (AI SDK v6 pattern)
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          tool: toolCall.toolName,
          output,
        });
      },
    });

  const isStreaming = status === "streaming";
  const isSubmitted = status === "submitted";
  const isDisabled = isStreaming || isSubmitted || isGenerating;

  // Show typing indicator only when waiting (no visible text yet)
  const showTypingIndicator = (() => {
    if (isSubmitted) return true;
    if (!isStreaming) return false;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return true;
    const text = (lastMsg.parts?.filter((p) => p.type === "text") || [])
      .map((p) => p.text)
      .join("");
    return !text;
  })();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isDisabled) return;

    let text = input;
    if (targetLayer) {
      text = `[Editing ${targetLayer.name} layer (id: ${targetLayer.id}, type: ${targetLayer.stemType})]: ${input}`;
      setTargetLayer(null);
    }

    sendMessage({ text });
    setInput("");
  };

  const handleSuggestionClick = (stemType: StemType) => {
    if (isDisabled) return;
    const label = stemType.replace("_", " ");
    sendMessage({ text: `add ${label}` });
  };

  return (
    <div
      className={`w-80 flex flex-col bg-[#0a0a0a] border-r border-white/10 ${isDragOver ? "ring-2 ring-[#c4f567]/50 ring-inset" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/layertune-layer")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setIsDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const raw = e.dataTransfer.getData("application/layertune-layer");
        if (!raw) return;
        const data = JSON.parse(raw);
        setTargetLayer(data);
        inputRef.current?.focus();
      }}
    >
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 studio-scroll"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[#c4f567]/10 flex items-center justify-center mb-3">
              <DjHead className="w-6 h-6 text-[#c4f567]" />
            </div>
            <p className="text-sm text-white/60 mb-1">
              What kind of music do you want to make?
            </p>
            <p className="text-xs text-white/30">
              Describe a vibe, genre, or feeling
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const textParts = msg.parts?.filter((p) => p.type === "text") || [];
          const textContent = textParts.map((p) => p.text).join("");

          if (msg.role === "user") {
            if (!textContent) return null;
            // Parse layer context prefix for chip display
            const layerMatch = textContent.match(
              /^\[Editing (.+?) layer \(id: .+?, type: (.+?)\)\]: ([\s\S]+)$/
            );
            const displayText = layerMatch ? layerMatch[3] : textContent;
            const chipName = layerMatch ? layerMatch[1] : null;
            const chipType = layerMatch ? (layerMatch[2] as StemType) : null;
            return (
              <div key={msg.id} className="flex gap-2 justify-end">
                <div className="max-w-[85%] bg-[#c4f567]/10 border border-[#c4f567]/20 rounded-lg px-3 py-2">
                  {chipName && chipType && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-white/60 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STEM_COLORS[chipType] }} />
                      {chipName}
                    </div>
                  )}
                  <p className="text-sm text-white/90">{displayText}</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-white/60" />
                </div>
              </div>
            );
          }

          if (msg.role === "assistant") {
            if (!textContent) return null;
            return (
              <div key={msg.id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-[#c4f567]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <DjHead className="w-3 h-3 text-[#c4f567]" />
                </div>
                <div className="max-w-[85%] bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  <p className="text-sm text-white/80 whitespace-pre-wrap">
                    {textContent}
                  </p>
                </div>
              </div>
            );
          }

          return null;
        })}

        {showTypingIndicator && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-[#c4f567]/20 flex items-center justify-center flex-shrink-0">
              <DjHead className="w-3 h-3 text-[#c4f567]" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <DjHead className="w-3 h-3 text-red-400" />
            </div>
            <div className="max-w-[85%]">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <p className="text-sm text-red-300">Something went wrong.</p>
              </div>
              <button
                type="button"
                onClick={() => regenerate()}
                className="mt-1 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Smart Suggestions */}
      {hasLayers && !isDisabled && (
        <div className="px-3 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {SMART_SUGGESTIONS.map((s) => (
              <button
                key={s.stemType}
                type="button"
                onClick={() => handleSuggestionClick(s.stemType)}
                className="px-2.5 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-3 py-3 border-t border-white/10"
      >
        {targetLayer && (
          <div className="pb-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: STEM_COLORS[targetLayer.stemType] }}
              />
              <span className="text-white/80">Editing {targetLayer.name}</span>
              <button
                type="button"
                onClick={() => setTargetLayer(null)}
                className="text-white/40 hover:text-white ml-0.5 leading-none"
              >
                &times;
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              targetLayer
                ? `What should change about ${targetLayer.name}?`
                : hasLayers
                  ? "Describe changes..."
                  : "Describe your music..."
            }
            disabled={isDisabled}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#c4f567]/50 disabled:opacity-50 transition-colors"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isDisabled}
            className="bg-[#c4f567] text-black hover:bg-[#b8e557] disabled:opacity-40 px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
