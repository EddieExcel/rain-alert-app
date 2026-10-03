/** Current weather fetch from Open-Meteo (free, no API key). */

export interface HourlyForecast {
  time: string[];
  precipitation: number[];
  weatherCode: number[];
}

export interface CurrentWeather {
  precipitation: number;
  weatherCode: number;
  time: string;
  hourly: HourlyForecast;
}

/** WMO weather codes that mean rain, drizzle, showers, or thunderstorms. */
const RAIN_CODES = new Set([
  51, 53, 55, 56, 57, // drizzle
  61, 63, 65, 66, 67, // rain
  71, 73, 75, 77, // snow (counts as precipitation falling)
  80, 81, 82, // showers
  85, 86, // snow showers
  95, 96, 99, // thunderstorm
]);

export function isRaining(w: CurrentWeather): boolean {
  return w.precipitation > 0 || RAIN_CODES.has(w.weatherCode);
}

function hourIsRaining(precipitation: number, weatherCode: number): boolean {
  return precipitation > 0 || RAIN_CODES.has(weatherCode);
}

/** Index of the first hourly slot at or after the current time. */
function currentHourIndex(hourly: HourlyForecast, nowIso: string): number {
  const hourPrefix = nowIso.slice(0, 13); // "YYYY-MM-DDTHH"
  const idx = hourly.time.findIndex((t) => t >= hourPrefix);
  return idx >= 0 ? idx : 0;
}

export interface SpellEstimate {
  /** Consecutive hours the current spell (rain or dry) is expected to last. */
  hours: number;
  /** True when the spell runs past the end of the fetched forecast. */
  beyondForecast: boolean;
}

/**
 * How long the current spell is expected to last, from the hourly
 * forecast. Pass raining=true to measure a rain spell, false for a dry
 * spell. Estimates are hour-resolution — good enough for a spoken alert.
 */
export function estimateSpell(w: CurrentWeather, raining: boolean): SpellEstimate {
  const h = w.hourly;
  const start = currentHourIndex(h, w.time);
  let hours = 0;
  let i = start;
  for (; i < h.time.length; i++) {
    if (hourIsRaining(h.precipitation[i] ?? 0, h.weatherCode[i] ?? 0) !== raining) break;
    hours++;
  }
  return { hours, beyondForecast: hours > 0 && i >= h.time.length };
}

export async function fetchCurrentWeather(
  lat: number,
  lon: number
): Promise<CurrentWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}` +
    `&longitude=${lon}&current=precipitation,weather_code&hourly=precipitation,weathercode&forecast_days=3&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather HTTP ${res.status}`);
  const j = await res.json();
  return {
    precipitation: Number(j?.current?.precipitation ?? 0),
    weatherCode: Number(j?.current?.weather_code ?? 0),
    time: String(j?.current?.time ?? ""),
    hourly: {
      time: (j?.hourly?.time ?? []) as string[],
      precipitation: (j?.hourly?.precipitation ?? []) as number[],
      weatherCode: (j?.hourly?.weathercode ?? []) as number[],
    },
  };
}
