"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import type { UIMessage } from "ai";
import { Send, User, Loader2, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { DjHead } from "@/components/icons/dj-head";
import { Button } from "@/components/ui/button";
import { SMART_SUGGESTIONS, STEM_COLORS, ALL_STEM_TYPES, STEM_LABELS } from "@/lib/layertune-types";
import type { StemType, Project, ModelProvider } from "@/lib/layertune-types";

const CHAT_STORAGE_KEY = "producething_chat_messages";

function loadChatMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const messages = JSON.parse(raw) as UIMessage[];
    // Strip trailing assistant messages with incomplete tool calls —
    // if the user closed the tab mid-generation, useChat would see these
    // as pending tool calls and never reach status="ready", blocking
    // all future sendMessage() calls (including pendingMessage from landing).
    while (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role !== "assistant") break;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasIncomplete = (last.parts as any[])?.some(
        (p) => (p.type === "tool-invocation" || p.type?.startsWith("tool-")) && p.state !== "output-available"
      );
      if (!hasIncomplete) break;
      messages.pop();
    }
    return messages;
  } catch { /* ignore */ }
  return [];
}

function saveChatMessages(messages: UIMessage[]) {
  if (typeof window === "undefined") return;
  try {
    // Only keep the last 50 messages to avoid localStorage bloat
    const toSave = messages.slice(-50);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* ignore - localStorage full */ }
}

const LAYER_CONTEXT_RE =
  /^\[Editing (.+?) layer \(id: .+?, type: (.+?)\)\]: ([\s\S]+)$/;

function getMessageText(msg: UIMessage): string {
  return (msg.parts?.filter((p) => p.type === "text") || [])
    .map((p) => p.text)
    .join("");
}

function getInputPlaceholder(
  targetLayer: { name: string } | null,
  hasLayers: boolean
): string {
  if (targetLayer) return `What should change about ${targetLayer.name}?`;
  if (hasLayers) return "Describe changes...";
  return "Describe your music...";
}

interface ChatPanelProps {
  project: Project;
  isGenerating: boolean;
  hasLayers: boolean;
  pendingMessage?: string | null;
  onPendingMessageConsumed?: () => void;
  onGenerateTrack: (
    topic: string,
    tags: string,
    instrumental: boolean,
    options?: { negative_tags?: string; lyrics?: string }
  ) => Promise<string>;
  onAddLayer: (stemType: StemType, tags: string) => Promise<string>;
  onRegenerateLayer: (layerId: string, description: string) => Promise<string>;
  onRemoveLayer: (layerId: string) => void;
  onSetLyrics: (lyrics: string) => void;
  modelProvider: ModelProvider;
  onModelProviderChange: (provider: ModelProvider) => void;
  agentMode: boolean;
  onAgentModeChange: (mode: boolean) => void;
}

export function ChatPanel({
  project,
  isGenerating,
  hasLayers,
  pendingMessage,
  onPendingMessageConsumed,
  onGenerateTrack,
  onAddLayer,
  onRegenerateLayer,
  onRemoveLayer,
  onSetLyrics,
  modelProvider,
  onModelProviderChange,
  agentMode,
  onAgentModeChange,
}: ChatPanelProps) {
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  });

  const modelProviderRef = useRef(modelProvider);
  const agentModeRef = useRef(agentMode);
  useEffect(() => {
    modelProviderRef.current = modelProvider;
    agentModeRef.current = agentMode;
  });

  /* eslint-disable react-hooks/refs -- body is a lazy callback, not render-time access */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          modelProvider: modelProviderRef.current,
          agentMode: agentModeRef.current,
        }),
      }),
    []
  );
  /* eslint-enable react-hooks/refs */

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [targetLayer, setTargetLayer] = useState<{
    id: string;
    name: string;
    stemType: StemType;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Restore chat messages from localStorage on mount
  const [initialMessages] = useState<UIMessage[]>(() => loadChatMessages());

  const { messages, sendMessage, addToolOutput, error, regenerate, status } =
    useChat({
      transport,
      initialMessages,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      async onToolCall({ toolCall }) {
        const p = projectRef.current;
        try {
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
              output = await onGenerateTrack(args.topic, args.tags, !!args.make_instrumental, {
                negative_tags: args.negative_tags,
                lyrics: args.lyrics,
              });
              break;
            }
            case "add_layer": {
              const args = toolCall.input as {
                stemType: StemType;
                tags?: string;
                topic?: string;
              };
              output = await onAddLayer(args.stemType, args.tags || args.topic || "");
              break;
            }
            case "regenerate_layer": {
              const args = toolCall.input as {
                layerId: string;
                newDescription: string;
                tags?: string;
              };
              const regenDescription = args.tags
                ? `${args.newDescription} [tags: ${args.tags}]`
                : args.newDescription;
              output = await onRegenerateLayer(args.layerId, regenDescription);
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
                duration: p.duration,
                layerCount: p.layers.length,
                layers: p.layers.map((l) => ({
                  id: l.id,
                  name: l.name,
                  stemType: l.stemType,
                  hasAudio: !!l.audioUrl,
                  generationStatus: l.generationStatus || null,
                  isMuted: l.isMuted,
                  isSoloed: l.isSoloed,
                  volume: l.volume,
                })),
                cachedStems: p.stemCache
                  .filter((s) => s.audioUrl && s.audioUrl !== "/api/audio-proxy?url=")
                  .map((s) => s.stemType),
                hasOriginalClip: !!p.originalClipId,
              };
              output = JSON.stringify(state);
              break;
            }
          }

          addToolOutput({
            toolCallId: toolCall.toolCallId,
            tool: toolCall.toolName,
            output,
          });
        } catch (err) {
          addToolOutput({
            toolCallId: toolCall.toolCallId,
            tool: toolCall.toolName,
            output: `Error: ${err instanceof Error ? err.message : "Tool execution failed"}`,
          });
        }
      },
    });

  const isStreaming = status === "streaming";
  const isSubmitted = status === "submitted";
  const isDisabled = isStreaming || isSubmitted || isGenerating;

  // Persist chat messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveChatMessages(messages);
    }
  }, [messages]);

  // Auto-send pending message from landing page
  // Defer to next tick so useChat transport is fully initialized (AI SDK v6 timing issue)
  const pendingConsumedRef = useRef(false);
  useEffect(() => {
    if (!pendingMessage) {
      pendingConsumedRef.current = false;
      return;
    }
    if (!pendingConsumedRef.current && status === "ready") {
      pendingConsumedRef.current = true;
      const id = setTimeout(() => {
        sendMessage({ text: pendingMessage });
        onPendingMessageConsumed?.();
      }, 50);
      return () => clearTimeout(id);
    }
  }, [pendingMessage, status, sendMessage, onPendingMessageConsumed]);

  // Show typing indicator when waiting for assistant text
  const showTypingIndicator =
    isSubmitted ||
    (isStreaming && !getLastAssistantText(messages));

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
          if (msg.role === "user") {
            const textContent = getMessageText(msg);
            if (!textContent) return null;
            return (
              <UserBubble
                key={msg.id}
                textContent={textContent}
              />
            );
          }

          if (msg.role === "assistant") {
            const parts = msg.parts || [];
            const hasContent = parts.some(
              (p) => (p.type === "text" && p.text.trim()) || p.type.startsWith("tool-") || p.type === "dynamic-tool"
            );
            if (!hasContent) return null;

            return (
              <AssistantMessage key={msg.id} parts={parts} />
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
                <p className="text-sm text-red-300">
                  {error.message?.includes("rate_limit") || error.message?.includes("Rate limit")
                    ? "Rate limited — wait a moment and retry."
                    : error.message || "Something went wrong."}
                </p>
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

      {/* Smart Suggestions — prioritize stems not yet added, allow duplicates */}
      {hasLayers && !isDisabled && (
        <StemSuggestions
          project={project}
          onAdd={handleSuggestionClick}
        />
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/10">
        <form onSubmit={handleSubmit}>
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
              placeholder={getInputPlaceholder(targetLayer, hasLayers)}
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

        {/* Model / Agent controls — below input like Claude's UI */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              if (agentMode) return;
              onModelProviderChange(modelProvider === "openai" ? "anthropic" : "openai");
            }}
            disabled={agentMode}
            className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(agentMode || modelProvider === "anthropic") ? (
              <AnthropicLogo className="w-3.5 h-3.5" />
            ) : (
              <OpenAILogo className="w-3.5 h-3.5" />
            )}
            <span>
              {(agentMode || modelProvider === "anthropic") ? "Claude Opus" : "GPT-5"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onAgentModeChange(!agentMode)}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-all ${
              agentMode
                ? "bg-[#c4f567]/15 text-[#c4f567]"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            <span className="text-[10px]">{agentMode ? "●" : "○"}</span>
            <span>{agentMode ? "Agent" : "Normal"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Sub-components for message bubbles --

function getLastAssistantText(messages: UIMessage[]): string {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== "assistant") return "";
  return getMessageText(lastMsg);
}

function UserBubble({ textContent }: { textContent: string }) {
  const layerMatch = textContent.match(LAYER_CONTEXT_RE);
  const displayText = layerMatch ? layerMatch[3] : textContent;
  const chipName = layerMatch ? layerMatch[1] : null;
  const chipType = layerMatch ? (layerMatch[2] as StemType) : null;

  return (
    <div className="flex gap-2 justify-end">
      <div className="max-w-[85%] bg-[#c4f567]/10 border border-[#c4f567]/20 rounded-lg px-3 py-2">
        {chipName && chipType && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-white/60 mb-1">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: STEM_COLORS[chipType] }}
            />
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

function StemSuggestions({ project, onAdd }: { project: Project; onAdd: (stemType: StemType) => void }) {
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const existingStems = new Set(project.layers.map((l) => l.stemType));
  const cachedStems = new Set(
    project.stemCache
      .filter((s) => s.audioUrl && s.audioUrl !== "/api/audio-proxy?url=")
      .map((s) => s.stemType)
  );

  // Prioritize cached stems in quick suggestions — they load instantly
  const available = SMART_SUGGESTIONS.filter((s) => !existingStems.has(s.stemType));
  const cachedFirst = [
    ...available.filter((s) => cachedStems.has(s.stemType)),
    ...available.filter((s) => !cachedStems.has(s.stemType)),
  ].slice(0, 4);

  useEffect(() => {
    if (!showAll) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowAll(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAll]);

  return (
    <div className="px-3 pb-2 relative" ref={panelRef}>
      <div className="flex flex-wrap-reverse justify-start gap-1.5">
        {cachedFirst.map((s) => {
          const isCached = cachedStems.has(s.stemType);
          return (
            <button
              key={s.stemType}
              type="button"
              onClick={() => onAdd(s.stemType)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                isCached
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400/80 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40"
                  : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20"
              }`}
            >
              {s.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
            showAll
              ? "bg-white/10 border-white/20 text-white/70"
              : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60"
          }`}
        >
          More...
        </button>
      </div>

      {showAll && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#141414] border border-white/10 rounded-lg p-2 shadow-xl z-20">
          <p className="text-[10px] text-white/30 uppercase tracking-wider px-1 pb-1.5">All instruments</p>
          <div className="grid grid-cols-2 gap-1">
            {ALL_STEM_TYPES.map((stemType) => {
              const count = project.layers.filter((l) => l.stemType === stemType).length;
              const isCached = cachedStems.has(stemType);
              return (
                <button
                  key={stemType}
                  type="button"
                  onClick={() => {
                    onAdd(stemType);
                    setShowAll(false);
                  }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors group ${
                    isCached ? "hover:bg-emerald-500/10" : "hover:bg-white/5"
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STEM_COLORS[stemType] }}
                  />
                  <span className={`flex-1 ${
                    isCached
                      ? "text-emerald-400/70 group-hover:text-emerald-300"
                      : "text-white/70 group-hover:text-white/90"
                  }`}>
                    {STEM_LABELS[stemType]}
                  </span>
                  {count > 0 && (
                    <span className="text-[10px] text-white/25">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AnthropicLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm2.327 5.14L6.22 15.25h5.35L8.896 8.66z" />
    </svg>
  );
}

function OpenAILogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

function formatToolArgs(toolName: string, input: Record<string, unknown> | undefined): string {
  if (!input) return toolName;
  switch (toolName) {
    case "generate_track":
      return `generate_track(${[input.topic && `"${input.topic}"`, input.tags && `tags: "${input.tags}"`].filter(Boolean).join(", ")})`;
    case "add_layer":
      return `add_layer(${input.stemType || ""}${input.tags ? `, "${input.tags}"` : ""})`;
    case "regenerate_layer":
      return `regenerate_layer(${input.layerId || ""}${input.newDescription ? `, "${input.newDescription}"` : ""})`;
    case "remove_layer":
      return `remove_layer(${input.layerId || ""})`;
    case "set_lyrics":
      return `set_lyrics(${typeof input.lyrics === "string" ? `"${input.lyrics.slice(0, 40)}${input.lyrics.length > 40 ? "..." : ""}"` : ""})`;
    case "get_composition_state":
      return "get_composition_state()";
    default:
      return `${toolName}(${JSON.stringify(input).slice(0, 60)})`;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToolCallBlock({ part }: { part: any }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = part.toolName || part.type?.replace("tool-", "") || "unknown";
  const isComplete = part.state === "output-available";
  const isError = part.state === "error";
  const isActive = !isComplete && !isError;
  const output = part.output;

  return (
    <div className="rounded-md border border-white/8 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/5 transition-colors text-left"
      >
        {isActive ? (
          <Loader2 className="w-3 h-3 animate-spin text-white/40 flex-shrink-0" />
        ) : (
          <ChevronRight className={`w-3 h-3 text-white/30 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
        )}
        <code className={`font-mono truncate ${
          isError ? "text-red-400/80" : isComplete ? "text-[#c4f567]/70" : "text-white/50"
        }`}>
          {formatToolArgs(toolName, part.input)}
        </code>
      </button>
      {expanded && output != null && (
        <div className="px-2.5 py-2 border-t border-white/5 bg-white/[0.02]">
          <pre className="font-mono text-[11px] text-white/40 whitespace-pre-wrap break-all max-h-32 overflow-y-auto studio-scroll">
            {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function AssistantMessage({ parts }: { parts: any[] }) {
  return (
    <div className="flex gap-2">
      <div className="w-6 h-6 rounded-full bg-[#c4f567]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <DjHead className="w-3 h-3 text-[#c4f567]" />
      </div>
      <div className="max-w-[85%] space-y-1.5">
        {parts.map((part, i) => {
          if (part.type === "text" && part.text.trim()) {
            return (
              <div key={i} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <div className="chat-markdown text-sm text-white/80">
                  <ReactMarkdown>{part.text}</ReactMarkdown>
                </div>
              </div>
            );
          }

          if (part.type?.startsWith("tool-") || part.type === "dynamic-tool") {
            return <ToolCallBlock key={part.toolCallId || i} part={part} />;
          }

          return null;
        })}
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
