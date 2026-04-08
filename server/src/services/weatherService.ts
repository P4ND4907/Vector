const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "clear skies",
  1: "mostly clear skies",
  2: "partly cloudy skies",
  3: "overcast skies",
  45: "foggy conditions",
  48: "icy fog",
  51: "light drizzle",
  53: "drizzle",
  55: "dense drizzle",
  56: "light freezing drizzle",
  57: "freezing drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "light freezing rain",
  67: "freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "light rain showers",
  81: "rain showers",
  82: "heavy rain showers",
  85: "light snow showers",
  86: "heavy snow showers",
  95: "a thunderstorm",
  96: "a thunderstorm with hail",
  99: "a severe thunderstorm with hail"
};

const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedWeatherSummary {
  expiresAt: number;
  summary: string;
}

interface GeocodingResponse {
  results?: Array<{
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  }>;
}

interface ForecastResponse {
  timezone?: string;
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
}

interface WttrTextValue {
  value?: string;
}

interface WttrCurrentCondition {
  temp_F?: string;
  weatherDesc?: WttrTextValue[];
}

interface WttrArea {
  areaName?: WttrTextValue[];
  region?: WttrTextValue[];
  country?: WttrTextValue[];
}

interface WttrHourlyForecast {
  time?: string;
  weatherDesc?: WttrTextValue[];
}

interface WttrDailyForecast {
  maxtempF?: string;
  mintempF?: string;
  hourly?: WttrHourlyForecast[];
}

interface WttrResponse {
  current_condition?: WttrCurrentCondition[];
  nearest_area?: WttrArea[];
  weather?: WttrDailyForecast[];
}

const weatherSummaryCache = new Map<string, CachedWeatherSummary>();

const formatLocationLabel = (parts: Array<string | undefined>) =>
  parts.filter(Boolean).join(", ");

const describeWeatherCode = (code?: number) =>
  typeof code === "number" ? WEATHER_CODE_LABELS[code] || "mixed conditions" : "mixed conditions";

const cleanWeatherDescription = (value?: string) =>
  value?.trim().replace(/\s+/g, " ").toLowerCase() || "mixed conditions";

const readTextValue = (values?: WttrTextValue[]) => values?.[0]?.value?.trim();

const readNumber = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readCachedSummary = (cacheKey: string) => {
  const cached = weatherSummaryCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    weatherSummaryCache.delete(cacheKey);
    return null;
  }

  return cached.summary;
};

const writeCachedSummary = (cacheKey: string, summary: string) => {
  weatherSummaryCache.set(cacheKey, {
    summary,
    expiresAt: Date.now() + WEATHER_CACHE_TTL_MS
  });
  return summary;
};

const fetchJson = async <T,>(url: string) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(4_500),
    headers: {
      Accept: "application/json",
      "User-Agent": "Vector-Control-Hub/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Weather lookup failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
};

const lookupPlace = async (requestedLocation: string) => {
  const attempts = Array.from(
    new Set(
      [
        requestedLocation.trim(),
        requestedLocation
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)[0]
      ].filter(Boolean)
    )
  );

  for (const attempt of attempts) {
    const geocoding = await fetchJson<GeocodingResponse>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(attempt)}&count=1&language=en&format=json`
    );

    const place = geocoding.results?.[0];
    if (place) {
      return place;
    }
  }

  return null;
};

const fetchOpenMeteoSummary = async (
  requestedLocation: string,
  dayOffset: 0 | 1
) => {
  const place = await lookupPlace(requestedLocation);
  if (!place) {
    throw new Error(`I could not find weather data for ${requestedLocation}.`);
  }

  const forecast = await fetchJson<ForecastResponse>(
    [
      "https://api.open-meteo.com/v1/forecast",
      `?latitude=${encodeURIComponent(String(place.latitude))}`,
      `&longitude=${encodeURIComponent(String(place.longitude))}`,
      "&temperature_unit=fahrenheit",
      "&timezone=auto",
      "&current=temperature_2m,weather_code",
      "&daily=weather_code,temperature_2m_max,temperature_2m_min",
      "&forecast_days=2"
    ].join("")
  );

  const label = formatLocationLabel([place.name, place.admin1, place.country]);

  if (dayOffset === 0) {
    const temperature = forecast.current?.temperature_2m;
    const conditions = describeWeatherCode(forecast.current?.weather_code);

    if (typeof temperature !== "number") {
      throw new Error(`The current weather is not available for ${label}.`);
    }

    return `Current weather in ${label} is ${Math.round(temperature)} degrees with ${conditions}.`;
  }

  const high = forecast.daily?.temperature_2m_max?.[1];
  const low = forecast.daily?.temperature_2m_min?.[1];
  const conditions = describeWeatherCode(forecast.daily?.weather_code?.[1]);

  if (typeof high !== "number" || typeof low !== "number") {
    throw new Error(`Tomorrow's forecast is not available for ${label}.`);
  }

  return `Tomorrow in ${label} looks like ${conditions}, with a high near ${Math.round(high)} and a low near ${Math.round(low)} degrees.`;
};

const pickWttrLabel = (requestedLocation: string, payload: WttrResponse) => {
  const area = payload.nearest_area?.[0];
  return (
    formatLocationLabel([
      readTextValue(area?.areaName),
      readTextValue(area?.region),
      readTextValue(area?.country)
    ]) || requestedLocation.trim()
  );
};

const pickWttrTomorrowDescription = (forecast?: WttrDailyForecast) => {
  const hourly = forecast?.hourly ?? [];
  const midday =
    hourly.find((entry) => entry.time === "1200") ??
    hourly.find((entry) => entry.time === "1500") ??
    hourly[Math.floor(hourly.length / 2)] ??
    hourly[0];

  return cleanWeatherDescription(readTextValue(midday?.weatherDesc));
};

const fetchWttrSummary = async (requestedLocation: string, dayOffset: 0 | 1) => {
  const payload = await fetchJson<WttrResponse>(
    `https://wttr.in/${encodeURIComponent(requestedLocation)}?format=j1`
  );

  const label = pickWttrLabel(requestedLocation, payload);

  if (dayOffset === 0) {
    const current = payload.current_condition?.[0];
    const temperature = readNumber(current?.temp_F);
    const conditions = cleanWeatherDescription(readTextValue(current?.weatherDesc));

    if (typeof temperature !== "number") {
      throw new Error(`The current weather is not available for ${label}.`);
    }

    return `Current weather in ${label} is ${Math.round(temperature)} degrees with ${conditions}.`;
  }

  const tomorrow = payload.weather?.[1];
  const high = readNumber(tomorrow?.maxtempF);
  const low = readNumber(tomorrow?.mintempF);
  const conditions = pickWttrTomorrowDescription(tomorrow);

  if (typeof high !== "number" || typeof low !== "number") {
    throw new Error(`Tomorrow's forecast is not available for ${label}.`);
  }

  return `Tomorrow in ${label} looks like ${conditions}, with a high near ${Math.round(high)} and a low near ${Math.round(low)} degrees.`;
};

export const fetchWeatherSummary = async (
  requestedLocation: string,
  dayOffset: 0 | 1 = 0
) => {
  const location = requestedLocation.trim();
  if (!location) {
    throw new Error("I need a location before I can check the weather.");
  }

  const cacheKey = `${location.toLowerCase()}::${dayOffset}`;
  const cached = readCachedSummary(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    return writeCachedSummary(cacheKey, await fetchOpenMeteoSummary(location, dayOffset));
  } catch (openMeteoError) {
    try {
      return writeCachedSummary(cacheKey, await fetchWttrSummary(location, dayOffset));
    } catch {
      if (openMeteoError instanceof Error) {
        throw openMeteoError;
      }

      throw new Error(`I could not reach the live weather service for ${location} right now.`);
    }
  }
};
