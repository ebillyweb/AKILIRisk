import React, { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { Button } from './Button';

interface AudioPlayButtonProps {
  /** Lazily resolves a playable (signed) URL when the user taps play. */
  resolveUrl: () => Promise<string>;
}

/** Fetches a signed URL on demand and plays it inline (advisor review, plan §4.3). */
export function AudioPlayButton({ resolveUrl }: AudioPlayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const handlePress = async () => {
    if (playing) {
      await soundRef.current?.stopAsync().catch(() => {});
      setPlaying(false);
      return;
    }
    setLoading(true);
    try {
      const url = await resolveUrl();
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false);
          sound.unloadAsync().catch(() => {});
        }
      });
      setPlaying(true);
      await sound.playAsync();
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      label={loading ? 'Loading…' : playing ? '■ Stop' : '▶ Play voice answer'}
      variant="secondary"
      onPress={handlePress}
      loading={loading}
    />
  );
}
