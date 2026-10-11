/** Video responses never expose operator instructions or arbitrary error text. */
export function videoFailureMessage(code?: string, hasScenes = false): string {
  const message = code === 'RECOVERY_EXHAUSTED'
    ? 'Generation stopped after 50 unsuccessful attempts. Your progress is saved.'
    : code === 'DOCUMENT'
    ? 'Your source material is too large. Please split it into smaller videos.'
    : code === 'LIMIT'
      ? 'Video creation is busy right now. Please try again later.'
      : ['AUTH', 'MODEL', 'CONFIG', 'NARRATION'].includes(code ?? '')
        ? 'Video creation is currently unavailable. Please try again later.'
        : "We couldn't finish creating this video. Please try creating it again.";
  return hasScenes ? `${message} You can still watch the parts that are ready.` : message;
}
