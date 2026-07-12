"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Square, Volume2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";

export interface QuestionTtsPlayPayload {
  moduleName?: string;
  questionText: string;
  context?: string;
  learnMore?: string;
  recordingTips?: string[];
  questionNumber: number;
  totalQuestions: number;
}

interface QuestionTtsPlayButtonProps extends QuestionTtsPlayPayload {
  /** Stable id when question content changes (resets cached audio). */
  contentKey: string;
  /** API route — use `/api/assessment/tts` for assessments, `/api/intake/tts` for intake. */
  endpoint: string;
  className?: string;
}

function playbackErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Your browser blocked autoplay. Click Replay question to listen.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Could not play question audio. Try again.";
}

/**
 * Play / replay question audio via server TTS (same pipeline as intake interview).
 */
export function QuestionTtsPlayButton({
  contentKey,
  endpoint,
  questionText,
  className,
}: QuestionTtsPlayButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const cachedBlobRef = useRef<Blob | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const stopPlayback = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // already stopped
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  };

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPlayback();
      revokeObjectUrl();
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    stopPlayback();
    revokeObjectUrl();
    cachedBlobRef.current = null;
    audioRef.current = null;
    setIsGenerating(false);
    setAudioReady(false);
  }, [contentKey]);

  const ensureAudioContext = () => {
    if (typeof window === "undefined") {
      throw new Error("Audio is not available");
    }
    if (!audioContextRef.current) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("Audio is not supported in this browser");
      }
      audioContextRef.current = new AudioContextCtor();
    }
    void audioContextRef.current.resume();
    return audioContextRef.current;
  };

  const playWithHtmlAudio = async (blob: Blob) => {
    const audioUrl = URL.createObjectURL(blob);
    revokeObjectUrl();
    objectUrlRef.current = audioUrl;

    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.onended = () => setIsSpeaking(false);
    audio.onerror = () => {
      setIsSpeaking(false);
      toast.error("Could not play question audio. Try again.");
    };
    audio.src = audioUrl;

    setIsSpeaking(true);
    await audio.play();
  };

  const playBlob = async (blob: Blob) => {
    stopPlayback();

    try {
      const context = ensureAudioContext();
      const audioBuffer = await context.decodeAudioData(await blob.arrayBuffer());
      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      source.onended = () => {
        sourceRef.current = null;
        setIsSpeaking(false);
      };
      sourceRef.current = source;
      setIsSpeaking(true);
      source.start(0);
    } catch (error) {
      await playWithHtmlAudio(blob);
    }
  };

  const handleSpeak = async () => {
    // Touch the audio graph synchronously so the click keeps user activation.
    try {
      ensureAudioContext();
      audioRef.current ??= new Audio();
    } catch (error) {
      toast.error(playbackErrorMessage(error));
      return;
    }

    if (cachedBlobRef.current && audioReady) {
      try {
        await playBlob(cachedBlobRef.current);
      } catch (error) {
        console.error("Question TTS replay error:", error);
        toast.error(playbackErrorMessage(error));
        setIsSpeaking(false);
      }
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ questionText }),
      });

      if (!response.ok) {
        let message = "Failed to generate question audio";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error?.trim()) message = payload.error.trim();
        } catch {
          // non-JSON error body
        }
        throw new Error(message);
      }

      const audioBlob = await response.blob();
      if (!audioBlob.size) {
        throw new Error("Question audio was empty");
      }

      cachedBlobRef.current = audioBlob;
      setAudioReady(true);
      await playBlob(audioBlob);
    } catch (error) {
      console.error("Question TTS playback error:", error);
      setIsSpeaking(false);
      toast.error(playbackErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    stopPlayback();
  };

  return isSpeaking ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleStop}
      className={className}
    >
      <Square className="size-4" />
      Stop
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void handleSpeak()}
      disabled={isGenerating}
      className={className}
    >
      {isGenerating ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Volume2 className="size-4" />
      )}
      {isGenerating ? "Preparing audio" : audioReady ? "Replay question" : "Play question"}
    </Button>
  );
}
