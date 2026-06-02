"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioPlayerProps {
  audioUrl: string;
  duration?: number;
  questionLabel?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function playbackErrorMessage(status: number | null): string {
  if (status === 401) {
    return "Sign in again to play this recording.";
  }
  if (status === 404) {
    return "Recording not found. It may have been removed or you may not have access.";
  }
  if (status === 500 || status === 403) {
    return "Recording storage is unavailable. Check S3 credentials (AWS profile / intake bucket) for this environment.";
  }
  return "Recording could not be loaded.";
}

async function probePlaybackStatus(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      credentials: "include",
      signal: AbortSignal.timeout(12_000),
    });
    return res.status;
  } catch {
    return null;
  }
}

export function AudioPlayer({ audioUrl, duration, questionLabel }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadStatus, setLoadStatus] = useState<number | null>(null);

  const playbackSpeeds = [0.75, 1, 1.25, 1.5];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setLoadState("loading");
    setLoadStatus(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setTotalDuration(duration || 0);
    setPlaybackRate(1);

    const handleLoadedMetadata = () => {
      setTotalDuration(audio.duration);
      setLoadState("ready");
      setLoadStatus(null);
    };

    const handleError = () => {
      void probePlaybackStatus(audioUrl).then((status) => {
        setLoadStatus(status);
        setLoadState("error");
        setIsPlaying(false);
      });
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("error", handleError);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    audio.load();

    const loadTimeoutId = window.setTimeout(() => {
      if (audio.readyState >= 1) return;
      void probePlaybackStatus(audioUrl).then((status) => {
        setLoadStatus(status);
        setLoadState("error");
        setIsPlaying(false);
      });
    }, 15_000);

    return () => {
      window.clearTimeout(loadTimeoutId);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [audioUrl, duration]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || loadState !== "ready") return;

    try {
      if (isPlaying) {
        audio.pause();
      } else {
        await audio.play();
      }
    } catch (error) {
      console.error("Audio playback error:", error);
      const status = await probePlaybackStatus(audioUrl);
      setLoadStatus(status);
      setLoadState("error");
      setIsPlaying(false);
    }
  };

  const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || loadState !== "ready") return;

    const newTime = parseFloat(event.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cyclePlaybackSpeed = () => {
    const audio = audioRef.current;
    if (!audio || loadState !== "ready") return;

    const currentIndex = playbackSpeeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % playbackSpeeds.length;
    const nextSpeed = playbackSpeeds[nextIndex];

    setPlaybackRate(nextSpeed);
    audio.playbackRate = nextSpeed;
  };

  if (loadState === "error") {
    return (
      <div className="rounded-lg bg-muted/30 p-4 space-y-2">
        <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
        <p className="text-sm text-muted-foreground text-center">
          {playbackErrorMessage(loadStatus)}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-muted/30 p-4 space-y-3">
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />

      {questionLabel && (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {questionLabel} recording
        </p>
      )}

      {loadState === "loading" && (
        <p className="text-sm text-muted-foreground text-center">Loading recording…</p>
      )}

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={togglePlayPause}
          className="h-8 w-8 p-0"
          disabled={loadState !== "ready"}
          aria-busy={loadState === "loading"}
        >
          {isPlaying ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
        </Button>

        <div className="flex-1 space-y-1">
          <input
            type="range"
            min={0}
            max={totalDuration || 0}
            value={currentTime}
            onChange={handleProgressChange}
            disabled={loadState !== "ready"}
            className="w-full h-1 bg-muted-foreground/20 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
          />
        </div>

        <div className="text-xs text-muted-foreground font-mono min-w-[80px] text-right">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={cyclePlaybackSpeed}
          className="h-8 px-2 text-xs font-mono"
          disabled={loadState !== "ready"}
        >
          {playbackRate}x
        </Button>
      </div>
    </div>
  );
}
