import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

export type RecorderState = 'idle' | 'recording' | 'recorded' | 'playing';

export interface UseAudioRecorder {
  state: RecorderState;
  durationMillis: number;
  uri: string | null;
  hasPermission: boolean | null;
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  play: () => Promise<void>;
  reset: () => void;
}

/** Wraps Expo AV record/playback into a small state machine for the Voice tab. */
export function useAudioRecorder(initialUri: string | null = null): UseAudioRecorder {
  const [state, setState] = useState<RecorderState>(initialUri ? 'recorded' : 'idle');
  const [durationMillis, setDurationMillis] = useState(0);
  const [uri, setUri] = useState<string | null>(initialUri);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      // Clean up native resources on unmount.
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const start = useCallback(async () => {
    const perm = await Audio.requestPermissionsAsync();
    setHasPermission(perm.granted);
    if (!perm.granted) return;

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    recording.setOnRecordingStatusUpdate((status) => {
      if (status.isRecording) setDurationMillis(status.durationMillis);
    });
    await recording.startAsync();
    recordingRef.current = recording;
    setState('recording');
  }, []);

  const stop = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return null;
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const recordedUri = recording.getURI();
    recordingRef.current = null;
    setUri(recordedUri ?? null);
    setState('recorded');
    return recordedUri ?? null;
  }, []);

  const play = useCallback(async () => {
    if (!uri) return;
    const { sound } = await Audio.Sound.createAsync({ uri });
    soundRef.current = sound;
    setState('playing');
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        setState('recorded');
      }
    });
    await sound.playAsync();
  }, [uri]);

  const reset = useCallback(() => {
    setUri(null);
    setDurationMillis(0);
    setState('idle');
  }, []);

  return { state, durationMillis, uri, hasPermission, start, stop, play, reset };
}
