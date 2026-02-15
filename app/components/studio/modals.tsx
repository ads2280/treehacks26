"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ─── Regenerate Modal ─────────────────────────────────────────────

interface RegenerateModalProps {
  open: boolean;
  layerName: string;
  onClose: () => void;
  onRegenerate: (prompt: string) => void;
}

export function RegenerateModal({
  open,
  layerName,
  onClose,
  onRegenerate,
}: RegenerateModalProps) {
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPrompt(""); // eslint-disable-line react-hooks/set-state-in-effect -- reset on dialog open
      // Auto-focus after dialog animation
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onRegenerate(prompt.trim());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            Regenerate {layerName}
          </DialogTitle>
          <DialogDescription className="text-white/50">
            How should this layer change? Describe the new vibe.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'make it more aggressive'"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#c4f567]/50 focus:ring-1 focus:ring-[#c4f567]/30 transition-colors"
          />
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!prompt.trim()}
              className="bg-[#c4f567] text-black hover:bg-[#b8e557] disabled:opacity-40"
            >
              Regenerate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirmation Dialog ───────────────────────────────────

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteDialog({ open, onClose, onConfirm }: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Delete Layer</DialogTitle>
          <DialogDescription className="text-white/50">
            Are you sure you want to remove this layer? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
