"use client";

import { useState, useEffect, useMemo } from 'react';
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

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (event.type === 'pipeline_update' && data.clients) {
          // Parse dates that came as strings from JSON
          const updatedClients = data.clients.map((client: any) => ({
            ...client,
            assignedAt: new Date(client.assignedAt),
            lastActivity: new Date(client.lastActivity),
            invitation: client.invitation ? {
              ...client.invitation,
              sentAt: new Date(client.invitation.sentAt),
            } : null,
            intake: client.intake ? {
              ...client.intake,
              submittedAt: client.intake.submittedAt ? new Date(client.intake.submittedAt) : null,
            } : null,
            assessment: client.assessment ? {
              ...client.assessment,
              completedAt: client.assessment.completedAt ? new Date(client.assessment.completedAt) : null,
            } : null,
          }));
          setClients(updatedClients);
          setLastUpdated(new Date(data.timestamp));
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

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

export function usePipelineFilters(clients: PipelineClient[]) {
  const [filters, setFilters] = useState<PipelineFilters>({
    sortBy: 'lastActivity',
    sortDir: 'desc',
  });

  const filteredClients = useMemo(() => {
    let filtered = clients.slice();

    if (filters.stage) {
      filtered = filtered.filter((client) => client.stage === filters.stage);
    }

    if (filters.stalled) {
      filtered = filtered.filter((client) => client.stalled);
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