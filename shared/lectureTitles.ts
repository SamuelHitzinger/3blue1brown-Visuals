/** Continue the numbered convention already used by this course. */
export function nextLectureTitle(previous: readonly { title: string }[]): string {
  let number = 0, prefix = 'Lecture';
  for (const { title } of previous) {
    const match = /^(Lecture|Lesson|Vorlesung)\s+(\d+)(?:\s*[:.\-–—]|\s*$)/i.exec(title.trim());
    const value = match ? Number(match[2]) : 0;
    if (Number.isSafeInteger(value) && value > number && value < Number.MAX_SAFE_INTEGER) {
      number = value; prefix = match![1];
    }
  }
  return `${prefix} ${Math.max(number, previous.length) + 1}`;
}
