'use client';

import { useEffect, useState } from 'react';
import { CloudSun, Moon, Sun, Sunrise, Sunset, X } from 'lucide-react';
import { AuthUser } from '@/lib/auth';
import { DayPart, Greeting, Mood, MOODS, saveMood, takeWelcome, todaysMood, welcomeGreeting } from '@/lib/greetings';

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
      <div className="notice-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white">
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{greeting.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{greeting.message}</p>
          </div>
          <button type="button" onClick={close} className="-mr-1 -mt-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-slate-500">
            {answered ? 'Thanks for sharing — you can change it any time today.' : mood ? 'Your mood today' : 'How are you feeling today?'}
          </p>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Your mood today">
            {MOODS.map(m => (
              <button key={m.key} type="button" role="radio" aria-checked={mood === m.key} onClick={() => choose(m.key)}
                className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[11px] font-medium transition-colors ${
                  mood === m.key ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                <span className="text-lg leading-none" aria-hidden>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* countdown; restarts after a mood is picked */}
        <div className="h-0.5 bg-slate-100">
          <div key={mood ?? 'asking'} className="notice-countdown h-full bg-blue-600/70" onAnimationEnd={close}
            style={{ animationDuration: `${mood ? DISMISS_AFTER_S : DISMISS_ASKING_S}s`, animationPlayState: paused ? 'paused' : 'running' }} />
        </div>
      </div>
    </div>
  );
}
