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

const formatLocationLabel = (parts: Array<string | undefined>) =>
  parts.filter(Boolean).join(", ");

const describeWeatherCode = (code?: number) =>
  typeof code === "number" ? WEATHER_CODE_LABELS[code] || "mixed conditions" : "mixed conditions";

const fetchJson = async <T,>(url: string) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(4_500),
    headers: {
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

export const fetchWeatherSummary = async (
  requestedLocation: string,
  dayOffset: 0 | 1 = 0
) => {
  const location = requestedLocation.trim();
  if (!location) {
    throw new Error("I need a location before I can check the weather.");
  }

  const place = await lookupPlace(location);
  if (!place) {
    throw new Error(`I could not find weather data for ${location}.`);
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
