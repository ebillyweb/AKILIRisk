import React, { useMemo } from 'react';
import { Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useClientIntake } from '@/hooks/useAdvisor';
import { fetchAudioPlaybackUrl } from '@/api/advisor';
import { config } from '@/config';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { PillarChip } from '@/components/PillarChip';
import { StatusPill } from '@/components/StatusPill';
import { AudioPlayButton } from '@/components/AudioPlayButton';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import type { IntakeQuestion, IntakeResponse } from '@/types';
import { palette } from '@/theme/colors';
import { fontSize, spacing } from '@/theme/spacing';

export default function AdvisorClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch, isRefetching } = useClientIntake(id);

  const byQuestion = useMemo(() => {
    const map: Record<string, IntakeResponse> = {};
    for (const r of data?.responses ?? []) map[r.questionId] = r;
    return map;
  }, [data]);

  const questions = useMemo(
    () => [...(data?.questions ?? [])].sort((a, b) => a.order - b.order),
    [data],
  );

  if (isLoading) return <LoadingView label="Loading intake…" />;
  if (isError) return <ErrorView message={(error as Error).message} onRetry={() => refetch()} />;
  if (!data) return <EmptyView title="Intake not found" />;

  const { client } = data;
  const openWeb = () => {
    Linking.openURL(`${config.apiBaseUrl}/advisor/clients/${client.id}`).catch(() => {});
  };

  return (
    <>
      <Stack.Screen options={{ title: client.name || 'Client' }} />
      <ScreenContainer
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.accent} />
        }
      >
        <Card>
          <View style={styles.headerRow}>
            <Text style={styles.name}>{client.name || client.email}</Text>
            <StatusPill status={client.intakeStatus} />
          </View>
          <Text style={styles.email}>{client.email}</Text>
        </Card>

        {questions.length === 0 ? (
          <EmptyView title="No responses yet" />
        ) : (
          questions.map((q) => (
            <ResponseCard
              key={q.id}
              question={q}
              response={byQuestion[q.id]}
              clientId={client.id}
            />
          ))
        )}

        <Button label="Approve & continue on web →" onPress={openWeb} />
        <Text style={styles.footnote}>
          Approving and returning intake for revision are completed on the web console.
        </Text>
      </ScreenContainer>
    </>
  );
}

function ResponseCard({
  question,
  response,
  clientId,
}: {
  question: IntakeQuestion;
  response?: IntakeResponse;
  clientId: string;
}) {
  const isVoice = response?.mode === 'VOICE' || (!response?.text && Boolean(response?.audioUrl));
  return (
    <Card>
      <PillarChip pillar={question.pillar} />
      <Text style={styles.prompt}>{question.prompt}</Text>

      {!response ? (
        <Text style={styles.noAnswer}>No answer</Text>
      ) : isVoice ? (
        <View style={styles.voiceBlock}>
          {response.transcript ? (
            <Text style={styles.transcript}>“{response.transcript}”</Text>
          ) : (
            <Text style={styles.pendingTranscript}>
              {response.transcriptionStatus === 'PROCESSING' ||
              response.transcriptionStatus === 'PENDING'
                ? 'Transcription in progress…'
                : 'Voice answer'}
            </Text>
          )}
          <AudioPlayButton
            resolveUrl={() => fetchAudioPlaybackUrl(clientId, question.id)}
          />
        </View>
      ) : (
        <Text style={styles.answer}>{response.text}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: palette.textPrimary, fontSize: fontSize.lg, fontWeight: '700', flex: 1 },
  email: { color: palette.textSecondary, fontSize: fontSize.sm },
  prompt: { color: palette.textPrimary, fontSize: fontSize.md, fontWeight: '700', lineHeight: 22 },
  answer: { color: palette.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  noAnswer: { color: palette.textMuted, fontSize: fontSize.sm, fontStyle: 'italic' },
  voiceBlock: { gap: spacing.md },
  transcript: { color: palette.textSecondary, fontSize: fontSize.sm, lineHeight: 20, fontStyle: 'italic' },
  pendingTranscript: { color: palette.textMuted, fontSize: fontSize.sm },
  footnote: { color: palette.textMuted, fontSize: fontSize.xs, textAlign: 'center' },
});
