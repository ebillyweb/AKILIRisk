"use client";

import { useState, useEffect, useMemo } from "react";
import type { PipelineClient, PipelineFilters } from './types';
import { getStageOrder } from './status';

export function usePipelineUpdates(initialClients: PipelineClient[]) {
  const [clients, setClients] = useState<PipelineClient[]>(initialClients);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const eventSource = new EventSource('/api/advisor/status-stream');

    eventSource.onopen = () => {
      setConnected(true);
    };

    const applyPipelineUpdate = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.clients) return;
        const updatedClients = data.clients.map((client: Record<string, unknown>) => ({
          ...(client as PipelineClient),
          assignedAt: new Date(client.assignedAt as string | Date),
          lastActivity: new Date(client.lastActivity as string | Date),
          invitation: client.invitation
            ? {
                ...(client.invitation as Record<string, unknown>),
                sentAt: new Date(
                  (client.invitation as { sentAt: string | Date }).sentAt,
                ),
              }
            : null,
          intake: client.intake
            ? {
                ...(client.intake as Record<string, unknown>),
                submittedAt: (client.intake as { submittedAt?: string | Date | null })
                  .submittedAt
                  ? new Date(
                      (client.intake as { submittedAt: string | Date }).submittedAt,
                    )
                  : null,
              }
            : null,
          assessment: client.assessment
            ? {
                ...(client.assessment as Record<string, unknown>),
                completedAt: (client.assessment as { completedAt?: string | Date | null })
                  .completedAt
                  ? new Date(
                      (client.assessment as { completedAt: string | Date }).completedAt,
                    )
                  : null,
              }
            : null,
        })) as PipelineClient[];
        setClients(updatedClients);
        setLastUpdated(new Date(data.timestamp));
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.addEventListener('pipeline_update', applyPipelineUpdate);

    eventSource.addEventListener('connected', () => {
      setConnected(true);
    });

    eventSource.addEventListener('error', () => {
      setConnected(false);
    });

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return { clients, connected, lastUpdated };
}

export function usePipelineFilters(
  clients: PipelineClient[],
  initialFilters?: PipelineFilters,
) {
  const [filters, setFilters] = useState<PipelineFilters>({
    sortBy: "lastActivity",
    sortDir: "desc",
    ...initialFilters,
  });

  const initialFiltersKey = JSON.stringify(initialFilters ?? {});

  useEffect(() => {
    setFilters({
      sortBy: "lastActivity",
      sortDir: "desc",
      ...(initialFilters ?? {}),
    });
  }, [initialFiltersKey]);

  const filteredClients = useMemo(() => {
    let filtered = clients.slice();

    if (filters.stage) {
      filtered = filtered.filter((client) => client.stage === filters.stage);
    }

    if (filters.stalled) {
      filtered = filtered.filter((client) => client.stalled);
    }

    if (filters.awaitingIntakeReview) {
      filtered = filtered.filter((client) => client.awaitingIntakeReview);
    }

    if (filters.documentsNeeded) {
      filtered = filtered.filter((client) => client.documentsNeeded);
    }

    if (filters.needsRescore) {
      filtered = filtered.filter((client) => client.needsRescore);
    }

    // Filter by search (name or email)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(client =>
        (client.name?.toLowerCase().includes(searchLower)) ||
        client.email.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (filters.sortBy) {
          case 'name':
            aValue = a.name || a.email;
            bValue = b.name || b.email;
            break;
          case 'stage':
            aValue = getStageOrder(a.stage);
            bValue = getStageOrder(b.stage);
            break;
          case 'progress':
            aValue = a.progress;
            bValue = b.progress;
            break;
          case 'lastActivity':
            aValue = a.lastActivity.getTime();
            bValue = b.lastActivity.getTime();
            break;
          default:
            return 0;
        }

        // Handle string comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return filters.sortDir === 'desc' ? -comparison : comparison;
        }

        // Handle numeric comparison
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return filters.sortDir === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [clients, filters]);

  const updateFilters = (newFilters: Partial<PipelineFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return { filters, filteredClients, updateFilters };
}