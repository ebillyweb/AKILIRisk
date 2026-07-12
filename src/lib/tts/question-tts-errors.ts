/** Client-safe copy when question audio cannot be generated. */
export const QUESTION_TTS_UNAVAILABLE_MESSAGE =
  "Support has been notified. Please try again later.";

type OpenAiLikeError = {
  status?: number;
  code?: string | null;
  message?: string;
};

function asOpenAiLikeError(error: unknown): OpenAiLikeError | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as OpenAiLikeError;
  if (typeof candidate.status !== "number") return null;
  return candidate;
}

/** Map OpenAI / runtime failures to a safe client-facing TTS error. */
export function mapQuestionTtsError(error: unknown): {
  status: number;
  error: string;
} {
  const openAi = asOpenAiLikeError(error);
  if (openAi?.status === 429) {
    return {
      status: 503,
      error: QUESTION_TTS_UNAVAILABLE_MESSAGE,
    };
  }

  if (openAi?.status === 401 || openAi?.status === 403) {
    return {
      status: 503,
      error: QUESTION_TTS_UNAVAILABLE_MESSAGE,
    };
  }

  return {
    status: 500,
    error: QUESTION_TTS_UNAVAILABLE_MESSAGE,
  };
}
