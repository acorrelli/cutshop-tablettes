import { BookOpen, CalendarDays, Disc3, Footprints, MessagesSquare, Mic } from 'lucide-react';
import type { EventKind } from '../lib/types';

export function eventIcon(kind: EventKind, size = 64) {
  switch (kind) {
    case 'dj':
      return <Disc3 size={size} strokeWidth={1.4} />;
    case 'talk':
      return <MessagesSquare size={size} strokeWidth={1.4} />;
    case 'read':
      return <BookOpen size={size} strokeWidth={1.4} />;
    case 'mic':
      return <Mic size={size} strokeWidth={1.4} />;
    case 'run':
      return <Footprints size={size} strokeWidth={1.4} />;
    default:
      return <CalendarDays size={size} strokeWidth={1.4} />;
  }
}

export function eventTone(kind: EventKind): 'green' | 'gold' | 'dark' {
  return kind === 'dj' || kind === 'mic' ? 'gold' : kind === 'read' ? 'dark' : 'green';
}
