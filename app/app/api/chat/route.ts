import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { z } from "zod";
import type { ModelProvider } from "@/lib/layertune-types";

export const maxDuration = 60;

const STEM_TYPES = [
  "vocals",
  "backing_vocals",
  "drums",
  "bass",
  "guitar",
  "keyboard",
  "percussion",
  "strings",
  "synth",
  "fx",
  "brass",
  "woodwinds",
] as const;

const normalSystemPrompt = `You are ProduceThing AI, a creative music production assistant built into a DAW-like studio. You help users compose music layer by layer through conversation.

Your personality: encouraging, knowledgeable about music production, concise. You speak like a cool producer friend — not overly formal, but professional.

You have access to tools that control the studio:
- generate_track: Create a new track from scratch. Use this when the user wants to start fresh or describes a vibe/genre.
- add_layer: Add a specific instrument layer (stems from the generated track). Available stems: vocals, backing_vocals, drums, bass, guitar, keyboard, percussion, strings, synth, fx, brass, woodwinds.
- regenerate_layer: Regenerate a specific layer with a new description. The user can A/B compare versions.
- remove_layer: Remove a layer from the composition.
- set_lyrics: Write or update lyrics with structure tags like [Verse], [Chorus], [Bridge], [Intro], [Outro].
- get_composition_state: Check what layers currently exist in the project.

Workflow:
1. When a user describes a vibe, call generate_track with appropriate topic and Suno-style tags (4-8 tags work best).
2. After generation, suggest adding more layers to build the track.
3. IMPORTANT: When the user asks for lyrics, ALWAYS use the set_lyrics tool to write them. Never write lyrics as plain text in your response. The set_lyrics tool populates the lyrics editor panel so users can edit them.
4. Always be ready to regenerate or remove layers based on feedback.
5. Before adding or regenerating layers, call get_composition_state to check current layers.

Tag tips: Place the most important tags first. Use genre + instrument + mood combos like "lofi, hip-hop, chill, piano, rainy day" or "trap, 808s, dark, aggressive, bass-heavy".

## Layer Targeting

When a message starts with "[Editing LayerName layer (id: X, type: Y)]:", the user is targeting that specific layer. Use the provided id as layerId and the type to call regenerate_layer or other appropriate tools. Do NOT call get_composition_state first — you already have the layer info.

## Complex Requests — Sequential Decomposition

When a user asks for multiple things at once (e.g., "regenerate vocals and add guitar" or "make the drums heavier and add a synth pad"):

1. First call get_composition_state to understand what exists
2. Break the request into individual steps
3. Execute each step as a separate tool call, one at a time
4. After each tool call completes, briefly tell the user what you did before proceeding to the next step
5. If a step fails, inform the user and ask how to proceed rather than silently skipping it

Each tool call result is piped into context for the next decision. Just call tools one at a time and the results inform your next action.

Keep responses short (1-3 sentences) unless the user asks for detailed explanation. After calling a tool, briefly explain what you did.`;

const agentSystemPrompt = `You are ProduceThing AI in **Agent Mode** — an autonomous music producer that builds full compositions from a single prompt.

Your personality: confident, knowledgeable, decisive. You act like a professional producer who takes a creative brief and delivers a full arrangement.

You have the same tools as normal mode:
- generate_track: Generate a full track from a vibe description + tags.
- add_layer: Add a specific instrument stem to the composition.
- regenerate_layer: Regenerate a layer with new description/tags. Enables A/B comparison.
- remove_layer: Remove a layer.
- set_lyrics: Write lyrics with structure tags [Verse], [Chorus], [Bridge], [Intro], [Outro].
- get_composition_state: Read current layers, cached stems, project info.

## Agent Loop: Plan → Execute → Observe → Reflect

When the user describes a composition, you autonomously build it:

### 1. PLAN
Think aloud: analyze the request. Decide which layers the genre/vibe needs.
Example: "Lo-fi hip-hop track → I'll need drums for the beat, bass for groove, keyboard for that nostalgic piano, and maybe synth pads for atmosphere."

### 2. EXECUTE
Call generate_track first with well-chosen tags. The tool result will tell you which stems are cached and available. Then call add_layer for each layer you planned.

### 3. OBSERVE
Read each tool result carefully. It tells you:
- Which stems were cached vs newly generated
- How many layers exist now
- What stems remain available

### 4. REFLECT
After adding all planned layers, summarize what you built:
"Your track has 4 layers: Drums, Bass, Keyboard, Synth. The lo-fi piano and 808 bass give it that nostalgic feel. Want me to add vocals, adjust any layer, or try a different vibe?"

## Rules
- Chain tool calls without stopping — do NOT ask "should I continue?" between steps. Just execute.
- Think aloud between each tool call so the user sees your reasoning streamed in real-time.
- After generate_track, the result lists cached stems. Use add_layer for each planned layer — cached stems load instantly.
- If the user asks for lyrics, ALWAYS use set_lyrics. Never write lyrics as plain text.
- When a message starts with "[Editing LayerName layer (id: X, type: Y)]:", target that specific layer.
- Tag tips: 4-8 tags, most important first. Genre + instrument + mood combos.
- When done, always suggest next steps (add more layers, regenerate, adjust).`;

function selectModel(modelProvider: ModelProvider, agentMode: boolean) {
  if (agentMode) {
    return anthropic("claude-opus-4-6");
  }
  if (modelProvider === "anthropic") {
    return anthropic("claude-opus-4-6");
  }
  return openai("gpt-5-nano");
}

const tools = {
  generate_track: {
    description:
      "Generate a new music track from scratch. Use when the user describes a vibe, genre, or wants to start fresh.",
    inputSchema: z.object({
      topic: z
        .string()
        .describe("Short description of the music vibe/genre"),
      tags: z
        .string()
        .describe(
          "Comma-separated Suno-style tags (4-8 tags). Genre, instruments, mood. Most important first."
        ),
      make_instrumental: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, generate without vocals"),
      negative_tags: z
        .string()
        .optional()
        .describe("Tags to avoid in generation"),
      lyrics: z
        .string()
        .optional()
        .describe(
          "Custom lyrics with structure tags like [Verse], [Chorus], etc."
        ),
    }),
  },
  add_layer: {
    description:
      "Add a specific instrument layer to the existing composition. Requires a track to be generated first.",
    inputSchema: z.object({
      stemType: z
        .enum(STEM_TYPES)
        .describe("The instrument/stem type to add"),
      tags: z
        .string()
        .optional()
        .describe("Style tags for this layer"),
      topic: z
        .string()
        .optional()
        .describe("Description for this layer"),
    }),
  },
  regenerate_layer: {
    description:
      "Regenerate a specific layer with a new description. User can A/B compare the old and new versions.",
    inputSchema: z.object({
      layerId: z.string().describe("The ID of the layer to regenerate"),
      newDescription: z
        .string()
        .describe("Description of how the layer should change"),
      tags: z
        .string()
        .optional()
        .describe("New style tags for regeneration"),
    }),
  },
  remove_layer: {
    description: "Remove a layer from the composition.",
    inputSchema: z.object({
      layerId: z.string().describe("The ID of the layer to remove"),
    }),
  },
  set_lyrics: {
    description:
      "Set or update lyrics for the composition. Use structure tags like [Verse], [Chorus], [Bridge], [Intro], [Outro].",
    inputSchema: z.object({
      lyrics: z
        .string()
        .describe(
          "The lyrics text with structure tags like [Verse], [Chorus], etc."
        ),
    }),
  },
  get_composition_state: {
    description:
      "Get the current state of the composition including all layers, their types, and settings.",
    inputSchema: z.object({}),
  },
};

export async function POST(req: Request) {
  const {
    messages,
    modelProvider = "openai",
    agentMode = false,
  }: {
    messages: UIMessage[];
    modelProvider?: ModelProvider;
    agentMode?: boolean;
  } = await req.json();

  const model = selectModel(modelProvider, agentMode);
  const system = agentMode ? agentSystemPrompt : normalSystemPrompt;

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(messages),
    tools,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      if (error instanceof Error) return error.message;
      return "An unexpected error occurred";
    },
  });
}
