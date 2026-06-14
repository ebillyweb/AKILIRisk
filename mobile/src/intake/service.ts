import { upsertDraft } from '@/db/drafts';
import { enqueueWrite } from '@/db/outbox';

/**
 * Local-first answer writes (plan §8.1): commit to SQLite + outbox immediately
 * so the UI never waits on the network. The caller triggers a sync pass after.
 */

export async function saveTypedAnswer(input: {
  interviewId: string;
  questionId: string;
  text: string;
}): Promise<void> {
  const updatedAt = new Date().toISOString();
  await upsertDraft({
    questionId: input.questionId,
    interviewId: input.interviewId,
    mode: 'TYPE',
    text: input.text,
    audioUri: null,
    updatedAt,
    syncState: 'QUEUED',
  });
  await enqueueWrite({
    interviewId: input.interviewId,
    questionId: input.questionId,
    mode: 'TYPE',
    text: input.text,
    updatedAt,
  });
}

export async function saveVoiceAnswer(input: {
  interviewId: string;
  questionId: string;
  audioUri: string;
}): Promise<void> {
  const updatedAt = new Date().toISOString();
  await upsertDraft({
    questionId: input.questionId,
    interviewId: input.interviewId,
    mode: 'VOICE',
    text: null,
    audioUri: input.audioUri,
    updatedAt,
    syncState: 'QUEUED',
  });
  await enqueueWrite({
    interviewId: input.interviewId,
    questionId: input.questionId,
    mode: 'VOICE',
    audioUri: input.audioUri,
    updatedAt,
  });
}
