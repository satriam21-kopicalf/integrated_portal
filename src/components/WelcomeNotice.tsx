'use client';

import { useEffect, useState } from 'react';
import { CloudSun, Moon, Sun, Sunrise, Sunset, X } from 'lucide-react';
import { AuthUser } from '@/lib/auth';
import { DayPart, Greeting, Mood, MOODS, saveMood, takeWelcome, todaysMood, welcomeGreeting } from '@/lib/greetings';
import { tr } from '@/lib/i18n';

export const DAY_PART_ICONS: Record<DayPart, typeof Sun> = {
  dawn: Sunrise, morning: Sun, midday: Sun, afternoon: CloudSun, evening: Sunset, night: Moon,
};

const DISMISS_AFTER_S = 12;
/** more time while the mood question is still open */
const DISMISS_ASKING_S = 20;

/**
 * Greeting shown once after each sign-in (top right): the time of day, the
 * user's name, a motivational line and "How are you feeling today?". The
 * picked mood changes the line right away and is remembered for the day.
 * Closes by itself; hovering or focusing it pauses the countdown.
 */
export default function WelcomeNotice({ user }: { user: AuthUser }) {
  const [greeting, setGreeting] = useState<Greeting | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [answered, setAnswered] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!takeWelcome()) return;
    const known = todaysMood(user.id);
    setMood(known);
    setGreeting(welcomeGreeting(user.displayName, known));
    // once per sign-in, for the user who just signed in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!greeting) return null;
  const Icon = DAY_PART_ICONS[greeting.part];
  const close = () => setGreeting(null);

  const choose = (m: Mood) => {
    saveMood(user.id, m);
    setMood(m);
    setAnswered(true);
    setGreeting(welcomeGreeting(user.displayName, m));
  };

  return (
    <div className="fixed inset-x-4 top-4 z-[75] sm:left-auto sm:right-4 sm:w-[380px]" role="status" aria-live="polite"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="notice-in overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white shadow-xl">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-white">
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--j-172B4D)]">{greeting.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-[color:var(--j-44546F)]">{greeting.message}</p>
          </div>
          <button type="button" onClick={close} className="-mr-1 -mt-1 rounded-[3px] p-1 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-091E420F)] hover:text-[color:var(--j-172B4D)]" aria-label={tr('Dismiss')}>
            <X size={16} />
          </button>
        </div>

        <div className="border-t border-[color:var(--j-F1F2F4)] bg-[color:var(--j-F7F8F9)] px-4 py-3">
          <p className="mb-2 text-xs font-medium text-[color:var(--j-626F86)]">
            {answered ? tr('Thanks for sharing — you can change it any time today.') : mood ? tr('Your mood today') : tr('How are you feeling today?')}
          </p>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={tr('Your mood today')}>
            {MOODS.map(m => (
              <button key={m.key} type="button" role="radio" aria-checked={mood === m.key} onClick={() => choose(m.key)}
                className={`flex flex-col items-center gap-0.5 rounded-[3px] border px-1 py-1.5 text-[11px] font-medium transition-colors ${
                  mood === m.key ? 'border-[color:var(--j-0C66E4)] bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0055CC)]' : 'border-[color:var(--j-DCDFE4)] bg-white text-[color:var(--j-44546F)] hover:border-[color:var(--j-8590A2)] hover:bg-[color:var(--j-F7F8F9)]'}`}>
                <span className="text-lg leading-none" aria-hidden>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* countdown; restarts after a mood is picked */}
        <div className="h-0.5 bg-[color:var(--j-091E420F)]">
          <div key={mood ?? 'asking'} className="notice-countdown h-full bg-[color:var(--j-0C66E4)]/70" onAnimationEnd={close}
            style={{ animationDuration: `${mood ? DISMISS_AFTER_S : DISMISS_ASKING_S}s`, animationPlayState: paused ? 'paused' : 'running' }} />
        </div>
      </div>
    </div>
  );
}
