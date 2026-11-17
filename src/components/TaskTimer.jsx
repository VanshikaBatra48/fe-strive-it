// src/components/TaskTimer.jsx
import { useState } from 'react';
import { useTaskTimer } from '../hooks/useTaskTimer';
import { formatDuration, formatHours } from '../utils/formatDuration';

export default function TaskTimer({ taskId, estimatedHours, taskStatus, canTrack }) {
  const t = useTaskTimer(taskId);
  const [note, setNote] = useState('');

  if (t.loading) return <p>Loading time data…</p>;

  const estimatedSeconds = estimatedHours * 3600;
  const pct = estimatedSeconds > 0 ? Math.min(100, (t.totalSeconds / estimatedSeconds) * 100) : 0;
  const over = t.totalSeconds > estimatedSeconds;
  const locked = ['submitted', 'complete'].includes(taskStatus);

  return (
    <section className="rounded-lg border p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="font-semibold">Time tracking</h3>
        <span className="text-sm text-gray-500">
          {formatHours(t.totalSeconds)}h of {estimatedHours}h estimated
        </span>
      </header>

      {/* Estimated vs actual */}
      <div className="h-2 w-full rounded bg-gray-200">
        <div
          className={`h-2 rounded ${over ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Live clock */}
      {t.isRunning && (
        <div className="text-center">
          <div className="font-mono text-3xl">{formatDuration(t.sessionSeconds)}</div>
          <div className="text-xs text-gray-500">current session</div>
        </div>
      )}

      {/* Controls: assigned mentee only */}
      {canTrack && !locked && (
        <div className="space-y-2">
          {t.isRunning ? (
            <>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What did you work on? (optional)"
                className="w-full rounded border px-2 py-1"
              />
              <button
                disabled={t.busy}
                onClick={async () => {
                  await t.stop(note || undefined);
                  setNote('');
                }}
                className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50"
              >
                Pause / Stop
              </button>
            </>
          ) : (
            <button
              disabled={t.busy}
              onClick={() => t.start()}
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {(t.summary?.logs.length ?? 0) > 0 ? 'Resume' : 'Start'}
            </button>
          )}
        </div>
      )}

      {t.error && <p className="text-sm text-red-600">{t.error}</p>}

      {/* Session history */}
      {t.summary && t.summary.logs.length > 0 && (
        <ul className="divide-y text-sm">
          {t.summary.logs.map((l) => (
            <li key={l.id} className="flex justify-between py-1">
              <span>
                {new Date(l.started_at).toLocaleString()}
                {l.auto_closed && (
                  <span className="ml-2 rounded bg-yellow-100 px-1 text-xs text-yellow-800">
                    auto-closed
                  </span>
                )}
                {l.note && <span className="ml-2 text-gray-500">· {l.note}</span>}
              </span>
              <span className="font-mono">
                {l.ended_at ? formatDuration(l.duration_seconds ?? 0) : 'running'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}