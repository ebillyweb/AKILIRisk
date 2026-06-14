import { apiRequest } from './client';
import { AdvisorClientList, ClientIntakeDetail, type AdvisorClient } from '@/types';

/** GET /api/advisor/clients — assigned clients for the signed-in advisor. */
export async function fetchAdvisorClients(): Promise<AdvisorClient[]> {
  const raw = await apiRequest<unknown>('/api/advisor/clients');
  return AdvisorClientList.parse(raw);
}

/** GET /api/advisor/clients/:id/intake — read-only intake transcript. */
export async function fetchClientIntake(clientId: string): Promise<ClientIntakeDetail> {
  const raw = await apiRequest<unknown>(`/api/advisor/clients/${clientId}/intake`);
  return ClientIntakeDetail.parse(raw);
}

/** Requests a short-lived signed URL to play back a voice answer. */
export async function fetchAudioPlaybackUrl(
  clientId: string,
  questionId: string,
): Promise<string> {
  const raw = await apiRequest<{ url: string }>(
    `/api/advisor/clients/${clientId}/audio/${questionId}`,
  );
  return raw.url;
}
