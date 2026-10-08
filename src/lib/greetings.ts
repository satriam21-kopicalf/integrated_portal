import { tr } from './i18n';
// Welcome (after sign-in) and farewell (after sign-out) messages.
// Lines depend on the time of day, the day of the week and the mood the user
// picked today; the last few shown lines are skipped so every sign-in reads
// differently. Everything is kept in this browser (localStorage /
// sessionStorage); nothing is sent to the server.

export type Mood = 'great' | 'good' | 'okay' | 'tired' | 'stressed';
export type DayPart = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export const MOODS: { key: Mood; emoji: string; label: string }[] = [
  { key: 'great', emoji: '🤩', get label() { return tr('Great'); } },
  { key: 'good', emoji: '🙂', get label() { return tr('Good'); } },
  { key: 'okay', emoji: '😐', get label() { return tr('Okay'); } },
  { key: 'tired', emoji: '😴', get label() { return tr('Tired'); } },
  { key: 'stressed', emoji: '😣', get label() { return tr('Stressed'); } },
];

interface Line {
  id: string;
  text: string;
}

const lines = (prefix: string, texts: string[]): Line[] => texts.map((text, i) => ({ id: `${prefix}${i}`, text }));

const WELCOME_BY_PART: Record<DayPart, Line[]> = {
  dawn: lines('dawn', [
    'The early hours belong to the focused. Good on you.',
    'Before the first customer walks in, there is you. That is dedication.',
    'A quiet start is the best time to plan a great day.',
  ]),
  morning: lines('morning', [
    'A fresh day, a fresh brew. Let’s make today count.',
    'Small wins before noon set the pace for the whole day.',
    'The first cups are poured — let’s see how the outlets are waking up.',
    'Great days are built one good decision at a time. Start with this one.',
  ]),
  midday: lines('midday', [
    'Halfway through the day. Keep the momentum going.',
    'Lunch rush is on — the numbers tell the story of a busy day.',
    'Take a breath, refill your cup, then finish strong.',
  ]),
  afternoon: lines('afternoon', [
    'The afternoon is where steady effort turns into results.',
    'Keep going — the last stretch of the day often brings the best work.',
    'A quick look at the numbers now saves a long night later.',
  ]),
  evening: lines('evening', [
    'Evening check-in: take a moment to celebrate what went well today.',
    'The day’s story is almost written. Let’s read it together.',
    'Thank you for the hard work today — you’re almost there.',
  ]),
  night: lines('night', [
    'Burning the midnight oil? Don’t forget to rest — tomorrow needs you too.',
    'Late-night focus is a superpower. Just don’t skip your sleep.',
    'The outlets are quiet, the data isn’t. Keep it short and get some rest.',
  ]),
};

// 0 = Sunday ... 6 = Saturday
const WELCOME_BY_DAY: Partial<Record<number, Line[]>> = {
  1: lines('mon', ['New week, new targets. You’ve got this.', 'Mondays set the tone for the week. Make it a good one.']),
  5: lines('fri', ['It’s Friday — finish the week proud.', 'One more push before the weekend. Make it count.']),
  6: lines('sat', ['Weekends are peak hours for the outlets — thanks for keeping an eye on things.']),
  0: lines('sun', ['Working on a Sunday? Your commitment doesn’t go unnoticed.']),
};

const WELCOME_GENERAL = lines('gen', [
  'Every cup sold is a customer made happy. Let’s keep it that way.',
  'Consistency beats intensity. Keep showing up.',
  'Data tells you what happened; you decide what happens next.',
  'Progress, not perfection.',
  'Good teams make good coffee. Thank you for being part of one.',
  'Focus on what you can improve today, one step at a time.',
  'Big results are just small efforts, repeated every day.',
]);

const WELCOME_BY_MOOD: Record<Mood, Line[]> = {
  great: lines('mgreat', [
    'Love that energy! Channel it into something big today.',
    'You’re on fire — a perfect day to tackle the hardest task first.',
    'Great mood, great day. Spread it to the team!',
  ]),
  good: lines('mgood', [
    'Glad to hear it. Let’s keep the good vibes brewing.',
    'A good mood is the best fuel. Make the most of it.',
    'Good days are made of good moments. Here’s to many more today.',
  ]),
  okay: lines('mokay', [
    'Steady is good. One small win can turn an okay day into a great one.',
    'Okay is a fine place to start. Let’s build from here.',
    'Not every day has to be amazing — showing up is what counts.',
  ]),
  tired: lines('mtired', [
    'Take it one task at a time — and maybe one more coffee. ☕',
    'Rest is part of the work too. Pace yourself today.',
    'Even small progress counts on tiring days. Be kind to yourself.',
  ]),
  stressed: lines('mstress', [
    'Breathe. Focus on the next step, not the whole staircase.',
    'You don’t have to solve everything at once. Start with one thing.',
    'Pressure means it matters. Take a short break if you need one — you’ve got this.',
  ]),
};

const FAREWELL_DAY = lines('fday', [
  'Thanks for checking in. Have a productive rest of the day.',
  'Go make great things happen out there.',
  'Everything’s in good hands. See you next time.',
]);
const FAREWELL_EVENING = lines('feve', [
  'Great work today. Time to recharge.',
  'Rest well — tomorrow is another chance to shine.',
  'You did your part today. Enjoy your evening.',
]);
const FAREWELL_WEEKEND = lines('fwkd', ['Have a great weekend — you’ve earned it.', 'Enjoy the weekend and come back refreshed.']);
const FAREWELL_HARD_DAY = lines('fhard', [
  'Today was a lot. Rest well, you’ve earned it.',
  'Leave the stress here. Tomorrow is a fresh start.',
  'Be proud of getting through today. Take good care of yourself.',
]);

/* ------------------------------------------------------------------ helpers */

export function dayPart(now: Date): DayPart {
  const h = now.getHours();
  if (h < 4) return 'night';
  if (h < 7) return 'dawn';
  if (h < 11) return 'morning';
  if (h < 14) return 'midday';
  if (h < 18) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
}

/** "Budi Santoso" -> "Budi"; a username stays as it is. */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

function localDay(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function read<T>(storage: 'local' | 'session', key: string): T | null {
  try {
    const raw = (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: 'local' | 'session', key: string, value: unknown) {
  try {
    const s = storage === 'local' ? window.localStorage : window.sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: nothing remembered */
  }
}

const RECENT_KEY = 'portal.greeting.recent';
const MOOD_KEY = 'portal.mood';
const SIGNED_IN_KEY = 'portal.signedInAt';
const WELCOME_KEY = 'portal.welcome.pending';
const FAREWELL_KEY = 'portal.farewell';

/** A line not shown recently (falls back to any line when all were). */
function pick(candidates: Line[]): string {
  const recent = read<string[]>('local', RECENT_KEY) ?? [];
  const fresh = candidates.filter(l => !recent.includes(l.id));
  const pool = fresh.length ? fresh : candidates;
  const line = pool[Math.floor(Math.random() * pool.length)];
  write('local', RECENT_KEY, [line.id, ...recent.filter(id => id !== line.id)].slice(0, 12));
  return line.text;
}

/* ------------------------------------------------------------------ mood */

export function todaysMood(userId: string, now = new Date()): Mood | null {
  const saved = read<{ user: string; day: string; mood: Mood }>('local', MOOD_KEY);
  return saved && saved.user === userId && saved.day === localDay(now) ? saved.mood : null;
}

export function saveMood(userId: string, mood: Mood, now = new Date()) {
  write('local', MOOD_KEY, { user: userId, day: localDay(now), mood });
}

/* ------------------------------------------------------------------ welcome */

const WELCOME_HEADLINE: Record<DayPart, string> = {
  get dawn() { return tr('Up early, {name}!'); },
  get morning() { return tr('Good morning, {name}'); },
  get midday() { return tr('Good afternoon, {name}'); },
  get afternoon() { return tr('Good afternoon, {name}'); },
  get evening() { return tr('Good evening, {name}'); },
  get night() { return tr('Working late, {name}?'); },
};

export interface Greeting {
  part: DayPart;
  title: string;
  message: string;
}

export function welcomeGreeting(displayName: string, mood: Mood | null, now = new Date()): Greeting {
  const part = dayPart(now);
  const candidates = mood
    ? WELCOME_BY_MOOD[mood]
    : [...WELCOME_BY_PART[part], ...WELCOME_BY_PART[part], ...(WELCOME_BY_DAY[now.getDay()] ?? []), ...WELCOME_GENERAL];
  return { part, title: WELCOME_HEADLINE[part].replace('{name}', firstName(displayName)), message: tr(pick(candidates)) };
}

/** Called right after a successful sign-in: the dashboard then shows the welcome once. */
export function markSignedIn() {
  write('session', WELCOME_KEY, true);
  write('local', SIGNED_IN_KEY, Date.now());
}

/** True once per sign-in (the flag is consumed). */
export function takeWelcome(): boolean {
  const pending = read<boolean>('session', WELCOME_KEY);
  if (pending) write('session', WELCOME_KEY, null);
  return Boolean(pending);
}

/* ------------------------------------------------------------------ farewell */

export interface Farewell extends Greeting {
  /** e.g. "2h 15m", when this browser knows when the session started (same day) */
  duration: string | null;
}

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Stores the message shown on the sign-in page after signing out. */
export function rememberFarewell(userId: string, displayName: string, now = new Date()) {
  const part = dayPart(now);
  const mood = todaysMood(userId, now);
  const weekendAhead = (now.getDay() === 5 && (part === 'evening' || part === 'night')) || now.getDay() === 6;
  const late = part === 'evening' || part === 'night';
  const candidates = mood === 'tired' || mood === 'stressed'
    ? FAREWELL_HARD_DAY
    : weekendAhead ? FAREWELL_WEEKEND : late ? FAREWELL_EVENING : FAREWELL_DAY;
  const name = firstName(displayName);
  const title = late ? tr('Good night, {0}', name) : part === 'dawn' || part === 'morning' ? tr('See you soon, {0}', name) : tr('See you later, {0}', name);
  const startedAt = read<number>('local', SIGNED_IN_KEY);
  const elapsed = startedAt ? now.getTime() - startedAt : -1;
  const farewell: Farewell = {
    part, title, message: tr(pick(candidates)), duration: elapsed > 0 && elapsed < 24 * 3600 * 1000 ? formatDuration(elapsed) : null,
  };
  write('session', FAREWELL_KEY, farewell);
  write('local', SIGNED_IN_KEY, null);
}

/** The farewell stored by the last sign-out (consumed). */
export function takeFarewell(): Farewell | null {
  const farewell = read<Farewell>('session', FAREWELL_KEY);
  if (farewell) write('session', FAREWELL_KEY, null);
  return farewell;
}
