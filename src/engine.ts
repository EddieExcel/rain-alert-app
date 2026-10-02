/**
 * Rain transition engine with hysteresis.
 *
 * - Rain start fires on the first rainy poll after a dry spell.
 * - Rain stop needs DRY_CONFIRM_POLLS consecutive dry polls so a brief
 *   lull in a storm doesn't trigger a false "stopped" alert.
 * - The very first reading only sets the state, never announces.
 */

export type RainState = "unknown" | "dry" | "raining";

export interface EngineState {
  state: RainState;
  /** Consecutive dry polls while state === "raining". */
  dryStreak: number;
  lastCheckIso: string | null;
}

export type RainEvent = "rain_started" | "rain_stopped" | null;

export const DRY_CONFIRM_POLLS = 2;

export const INITIAL_ENGINE_STATE: EngineState = {
  state: "unknown",
  dryStreak: 0,
  lastCheckIso: null,
};

export function updateEngine(
  prev: EngineState,
  rainingNow: boolean,
  nowIso: string
): { next: EngineState; event: RainEvent } {
  if (rainingNow) {
    const event: RainEvent = prev.state === "dry" ? "rain_started" : null;
    return {
      next: { state: "raining", dryStreak: 0, lastCheckIso: nowIso },
      event,
    };
  }
  // Dry poll.
  if (prev.state === "raining") {
    const dryStreak = prev.dryStreak + 1;
    if (dryStreak >= DRY_CONFIRM_POLLS) {
      return {
        next: { state: "dry", dryStreak: 0, lastCheckIso: nowIso },
        event: "rain_stopped",
      };
    }
    return {
      next: { state: "raining", dryStreak, lastCheckIso: nowIso },
      event: null,
    };
  }
  return {
    next: { state: "dry", dryStreak: 0, lastCheckIso: nowIso },
    event: null,
  };
}
