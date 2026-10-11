import type { Lesson } from '../../src/data'

// Sample scenes for playback tests and compatibility benchmarks only.
export const lessons: Lesson[] = [
  { id: 'carbon', title: 'Carbon, the great connector', subtitle: 'Why four bonds change everything', subject: 'Organic chemistry', duration: 154, artwork: 'molecule', color: 'sage' },
  { id: 'orbitals', title: 'Orbitals without the overwhelm', subtitle: 'A little space for electrons', subject: 'Organic chemistry', duration: 198, artwork: 'orbitals', color: 'lavender', progress: 0.36 },
  { id: 'reactions', title: 'Follow the electrons', subtitle: 'Reaction mechanisms, made simple', subject: 'Organic chemistry', duration: 242, artwork: 'reaction', color: 'peach' },
  { id: 'vectors', title: 'A different way to see vectors', subtitle: 'More than an arrow on a page', subject: 'Linear algebra', duration: 172, artwork: 'vectors', color: 'blue' },
  { id: 'matrices', title: 'What a matrix really does', subtitle: 'Watch a whole space transform', subject: 'Linear algebra', duration: 215, artwork: 'matrix', color: 'butter' },
  { id: 'eigen', title: 'Meet the eigenvectors', subtitle: 'The directions that stay themselves', subject: 'Linear algebra', duration: 188, artwork: 'eigen', color: 'sage' },
]
