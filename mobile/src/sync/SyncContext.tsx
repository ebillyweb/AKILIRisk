import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { drainOutbox } from './syncWorker';
import { countPending, getDeadLetters, retryDeadLetters, type OutboxRow } from '@/db/outbox';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  deadLetters: OutboxRow[];
  /** Kick a sync pass now (e.g. right after saving an answer). */
  triggerSync: () => void;
  /** Re-queue failed writes and try again. */
  retryFailed: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

const SyncContext = createContext<SyncState | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [deadLetters, setDeadLetters] = useState<OutboxRow[]>([]);
  const onlineRef = useRef(true);

  const refreshCounts = useCallback(async () => {
    const [count, dead] = await Promise.all([countPending(), getDeadLetters()]);
    setPendingCount(count);
    setDeadLetters(dead);
  }, []);

  const runSync = useCallback(async () => {
    if (!onlineRef.current) return;
    setIsSyncing(true);
    try {
      await drainOutbox();
    } finally {
      setIsSyncing(false);
      await refreshCounts();
    }
  }, [refreshCounts]);

  const triggerSync = useCallback(() => {
    void runSync();
  }, [runSync]);

  const retryFailed = useCallback(async () => {
    await retryDeadLetters();
    await refreshCounts();
    void runSync();
  }, [refreshCounts, runSync]);

  useEffect(() => {
    void refreshCounts();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      onlineRef.current = online;
      setIsOnline(online);
      if (online) void runSync();
    });

    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void runSync();
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
    };
  }, [refreshCounts, runSync]);

  const value = useMemo<SyncState>(
    () => ({
      isOnline,
      isSyncing,
      pendingCount,
      deadLetters,
      triggerSync,
      retryFailed,
      refreshCounts,
    }),
    [isOnline, isSyncing, pendingCount, deadLetters, triggerSync, retryFailed, refreshCounts],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}
