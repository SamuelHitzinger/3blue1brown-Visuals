let loading: Promise<typeof import('animlib')> | undefined

/** Share the download across hover, navigation, and player startup; failed loads can retry. */
export function loadLessonRuntime() {
  return loading ??= import('animlib').catch(error => { loading = undefined; throw error })
}

export function preloadLessonRuntime() { void loadLessonRuntime().catch(() => {}) }
