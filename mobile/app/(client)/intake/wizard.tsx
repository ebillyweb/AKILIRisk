import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useIntakeScript } from '@/hooks/useIntake';
import { useSync } from '@/sync/SyncContext';
import { allDraftsSynced, getDraftsForInterview, type DraftRow } from '@/db/drafts';
import { saveTypedAnswer, saveVoiceAnswer } from '@/intake/service';
import { submitIntake } from '@/api/intake';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { ModeTabs } from '@/components/ModeTabs';
import { PillarChip } from '@/components/PillarChip';
import { SaveStatusPill } from '@/components/SaveStatusPill';
import { VoiceAnswer } from '@/components/VoiceAnswer';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ErrorView, LoadingView } from '@/components/StateViews';
import type { ResponseMode } from '@/types';
import { palette } from '@/theme/colors';
import { fontSize, radius, spacing } from '@/theme/spacing';

export default function IntakeWizard() {
  const { data, isLoading, isError, error, refetch } = useIntakeScript();
  const { triggerSync } = useSync();

  const questions = useMemo(
    () => [...(data?.questions ?? [])].sort((a, b) => a.order - b.order),
    [data],
  );

  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [mode, setMode] = useState<ResponseMode>('TYPE');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const interviewId = data?.interviewId;
  const current = questions[index];

  const loadDrafts = useCallback(async () => {
    if (!interviewId) return;
    const rows = await getDraftsForInterview(interviewId);
    setDrafts(Object.fromEntries(rows.map((r) => [r.questionId, r])));
  }, [interviewId]);

  // Refresh drafts whenever the screen regains focus (e.g. after a sync).
  useFocusEffect(
    useCallback(() => {
      void loadDrafts();
    }, [loadDrafts]),
  );

  // Hydrate the editor when the current question changes.
  React.useEffect(() => {
    if (!current) return;
    const draft = drafts[current.id];
    setMode(draft?.mode ?? 'TYPE');
    setText(draft?.text ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, drafts]);

  if (isLoading) return <LoadingView label="Loading questions…" />;
  if (isError) return <ErrorView message={(error as Error).message} onRetry={() => refetch()} />;
  if (!current || !interviewId) {
    return <ErrorView message="No intake questions are available yet." onRetry={() => refetch()} />;
  }

  const draft = drafts[current.id];
  const isLast = index === questions.length - 1;
  const answeredCount = Object.keys(drafts).length;

  const handleSaveTyped = async (advance: boolean) => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await saveTypedAnswer({ interviewId, questionId: current.id, text: text.trim() });
      await loadDrafts();
      triggerSync();
      if (advance && !isLast) setIndex((i) => i + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVoice = async (uri: string) => {
    await saveVoiceAnswer({ interviewId, questionId: current.id, audioUri: uri });
    await loadDrafts();
    triggerSync();
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const synced = await allDraftsSynced(interviewId);
    if (!synced) {
      setSubmitError(
        'Some answers are still saving. Stay connected for a moment, then submit again.',
      );
      triggerSync();
      return;
    }
    setSubmitting(true);
    try {
      const { referenceId } = await submitIntake(interviewId);
      router.replace({
        pathname: '/(client)/intake/confirm',
        params: { referenceId, answered: String(answeredCount), total: String(questions.length) },
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer contentStyle={{ paddingHorizontal: 0 }}>
        <OfflineBanner />
        <View style={styles.body}>
          {/* Progress */}
          <View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${((index + 1) / questions.length) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              Question {index + 1} of {questions.length}
            </Text>
          </View>

          {/* Question */}
          <View style={styles.questionBlock}>
            <PillarChip pillar={current.pillar} />
            <Text style={styles.prompt}>{current.prompt}</Text>
            {current.helpText ? <Text style={styles.help}>{current.helpText}</Text> : null}
            {draft ? <SaveStatusPill state={draft.syncState} /> : null}
          </View>

          {/* Answer */}
          <ModeTabs mode={mode} onChange={setMode} voiceDisabled={current.allowVoice === false} />

          {mode === 'TYPE' ? (
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type your answer…"
              placeholderTextColor={palette.textMuted}
              multiline
              style={styles.textArea}
              maxLength={4000}
            />
          ) : (
            <VoiceAnswer
              key={current.id}
              initialUri={draft?.mode === 'VOICE' ? draft.audioUri : null}
              onSave={handleSaveVoice}
            />
          )}

          {mode === 'TYPE' ? (
            <View style={styles.charRow}>
              <Text style={styles.charCount}>{text.length}/4000</Text>
            </View>
          ) : null}

          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

          {/* Controls */}
          <View style={styles.controls}>
            <View style={styles.navRow}>
              <Button
                label="Previous"
                variant="ghost"
                onPress={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                style={styles.navBtn}
              />
              {!isLast ? (
                <Button
                  label="Next"
                  variant="secondary"
                  onPress={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                  style={styles.navBtn}
                />
              ) : (
                <View style={styles.navBtn} />
              )}
            </View>

            {mode === 'TYPE' ? (
              <Button
                label={isLast ? 'Save answer' : 'Save & next'}
                onPress={() => handleSaveTyped(!isLast)}
                loading={saving}
                disabled={!text.trim()}
              />
            ) : null}

            {isLast ? (
              <Button
                label="Submit intake"
                onPress={handleSubmit}
                loading={submitting}
              />
            ) : null}
          </View>
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.background },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: palette.accent, borderRadius: radius.pill },
  progressLabel: { color: palette.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
  questionBlock: { gap: spacing.sm },
  prompt: { color: palette.textPrimary, fontSize: fontSize.lg, fontWeight: '700', lineHeight: 28 },
  help: { color: palette.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  textArea: {
    minHeight: 140,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    color: palette.textPrimary,
    fontSize: fontSize.md,
    textAlignVertical: 'top',
  },
  charRow: { alignItems: 'flex-end' },
  charCount: { color: palette.textMuted, fontSize: fontSize.xs },
  error: { color: palette.danger, fontSize: fontSize.sm },
  controls: { gap: spacing.md },
  navRow: { flexDirection: 'row', gap: spacing.md },
  navBtn: { flex: 1 },
});
