// Pure module (no runtime imports) so backend-tests can load it directly.
//
// Mirrors the exact semantics of the one-time timetable.instrument backfill
// in db/schema.sql ("Founder request 2026-10-05"): a class_name matches an
// instrument when it CONTAINS the instrument's name as a case-insensitive
// substring (e.g. "Guitar — Advanced" contains "Guitar"). The longest
// instrument name is tried first, so a more specific name (e.g.
// "Piano / Keyboard") wins over a shorter, coincidental match.
//
// This function is not wired into any live write path — the backfill itself
// runs once, in SQL, against existing rows. It exists so that matching logic
// has a single, testable definition instead of living only inside a
// migration no test can exercise.

/** The best-guess instrument for a free-text class name, or null if none of
 *  the given instrument names appears in it. */
export function matchInstrumentForClassName(className: string, instrumentNames: string[]): string | null {
  const name = (className ?? "").toLowerCase();
  if (!name) return null;
  const sorted = [...instrumentNames].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const inst of sorted) {
    if (name.includes(inst.toLowerCase())) return inst;
  }
  return null;
}
