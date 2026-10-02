/** Current weather fetch from Open-Meteo (free, no API key). */

export interface CurrentWeather {
  precipitation: number;
  weatherCode: number;
  time: string;
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

export async function fetchCurrentWeather(
  lat: number,
  lon: number
): Promise<CurrentWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}` +
    `&longitude=${lon}&current=precipitation,weather_code&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather HTTP ${res.status}`);
  const j = await res.json();
  return {
    precipitation: Number(j?.current?.precipitation ?? 0),
    weatherCode: Number(j?.current?.weather_code ?? 0),
    time: String(j?.current?.time ?? ""),
  };
}
