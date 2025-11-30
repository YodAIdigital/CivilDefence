// Google Weather API service for fetching current weather conditions

export interface WeatherCondition {
  currentTime: string
  timeZone: {
    id: string
  }
  isDaytime: boolean
  weatherCondition: {
    iconBaseUri: string
    description: {
      text: string
      languageCode: string
    }
    type: string
  }
  temperature: {
    degrees: number
    unit: string
  }
  feelsLikeTemperature: {
    degrees: number
    unit: string
  }
  relativeHumidity: number
  uvIndex: number
  precipitation: {
    probability: {
      percent: number
      type: string
    }
  }
  wind: {
    direction: {
      degrees: number
      cardinal: string
    }
    speed: {
      value: number
      unit: string
    }
    gust?: {
      value: number
      unit: string
    }
  }
  visibility: {
    distance: number
    unit: string
  }
  cloudCover: number
  airPressure: {
    meanSeaLevelMillibars: number
  }
}

export interface WeatherData {
  condition: string
  description: string
  iconUrl: string
  temperature: number
  feelsLike: number
  humidity: number
  windSpeed: number
  windDirection: string
  uvIndex: number
  visibility: number
  cloudCover: number
  precipitationProbability: number
  isDaytime: boolean
  lastUpdated: Date
}

export interface WeatherError {
  message: string
  code?: string
}

const WEATHER_CACHE_KEY = 'civil_defence_weather'
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes in milliseconds

interface CachedWeather {
  data: WeatherData
  timestamp: number
  lat: number
  lng: number
}

function getCachedWeather(lat: number, lng: number): WeatherData | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY)
    if (!cached) return null

    const parsedCache: CachedWeather = JSON.parse(cached)
    const now = Date.now()

    // Check if cache is still valid (within 15 minutes and same location within 0.01 degrees)
    const isTimeValid = now - parsedCache.timestamp < CACHE_DURATION
    const isLocationSame =
      Math.abs(parsedCache.lat - lat) < 0.01 &&
      Math.abs(parsedCache.lng - lng) < 0.01

    if (isTimeValid && isLocationSame) {
      return {
        ...parsedCache.data,
        lastUpdated: new Date(parsedCache.data.lastUpdated)
      }
    }

    return null
  } catch {
    return null
  }
}

function setCachedWeather(data: WeatherData, lat: number, lng: number): void {
  if (typeof window === 'undefined') return

  try {
    const cacheData: CachedWeather = {
      data,
      timestamp: Date.now(),
      lat,
      lng
    }
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cacheData))
  } catch {
    // Ignore storage errors
  }
}

export async function fetchCurrentWeather(
  lat: number,
  lng: number
): Promise<{ data?: WeatherData; error?: WeatherError }> {
  // Check cache first
  const cached = getCachedWeather(lat, lng)
  if (cached) {
    return { data: cached }
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return {
      error: {
        message: 'Weather service not configured',
        code: 'NO_API_KEY'
      }
    }
  }

  try {
    const url = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=${lat}&location.longitude=${lng}`

    const response = await fetch(url)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        error: {
          message: errorData.error?.message || `Weather API error: ${response.status}`,
          code: errorData.error?.code || `HTTP_${response.status}`
        }
      }
    }

    const result: WeatherCondition = await response.json()

    // Transform API response to our simplified format
    const weatherData: WeatherData = {
      condition: result.weatherCondition?.type || 'UNKNOWN',
      description: result.weatherCondition?.description?.text || 'Unknown conditions',
      iconUrl: result.weatherCondition?.iconBaseUri
        ? `${result.weatherCondition.iconBaseUri}`
        : '',
      temperature: Math.round(result.temperature?.degrees || 0),
      feelsLike: Math.round(result.feelsLikeTemperature?.degrees || 0),
      humidity: result.relativeHumidity || 0,
      windSpeed: Math.round(result.wind?.speed?.value || 0),
      windDirection: result.wind?.direction?.cardinal || '',
      uvIndex: result.uvIndex || 0,
      visibility: Math.round(result.visibility?.distance || 0),
      cloudCover: result.cloudCover || 0,
      precipitationProbability: result.precipitation?.probability?.percent || 0,
      isDaytime: result.isDaytime ?? true,
      lastUpdated: new Date()
    }

    // Cache the result
    setCachedWeather(weatherData, lat, lng)

    return { data: weatherData }
  } catch (err) {
    return {
      error: {
        message: err instanceof Error ? err.message : 'Failed to fetch weather data',
        code: 'FETCH_ERROR'
      }
    }
  }
}

// Get weather icon based on condition type
export function getWeatherIcon(condition: string, isDaytime: boolean): string {
  const conditionMap: Record<string, string> = {
    CLEAR: isDaytime ? 'wb_sunny' : 'nights_stay',
    MOSTLY_CLEAR: isDaytime ? 'wb_sunny' : 'nights_stay',
    PARTLY_CLOUDY: isDaytime ? 'partly_cloudy_day' : 'partly_cloudy_night',
    MOSTLY_CLOUDY: 'cloud',
    CLOUDY: 'cloud',
    OVERCAST: 'cloud',
    FOG: 'foggy',
    LIGHT_FOG: 'foggy',
    DRIZZLE: 'grain',
    LIGHT_RAIN: 'grain',
    RAIN: 'rainy',
    HEAVY_RAIN: 'thunderstorm',
    SHOWERS: 'rainy',
    THUNDERSTORM: 'thunderstorm',
    LIGHT_SNOW: 'ac_unit',
    SNOW: 'ac_unit',
    HEAVY_SNOW: 'severe_cold',
    SLEET: 'weather_mix',
    HAIL: 'weather_hail',
    WINDY: 'air',
    UNKNOWN: isDaytime ? 'wb_sunny' : 'nights_stay'
  }

  return conditionMap[condition] ?? conditionMap['UNKNOWN']!
}

// Get background color class based on weather condition
export function getWeatherBackground(condition: string, isDaytime: boolean): string {
  if (!isDaytime) {
    return 'from-indigo-900 to-slate-900'
  }

  const backgroundMap: Record<string, string> = {
    CLEAR: 'from-blue-400 to-sky-300',
    MOSTLY_CLEAR: 'from-blue-400 to-sky-300',
    PARTLY_CLOUDY: 'from-blue-400 to-slate-300',
    MOSTLY_CLOUDY: 'from-slate-400 to-slate-300',
    CLOUDY: 'from-slate-500 to-slate-400',
    OVERCAST: 'from-slate-600 to-slate-500',
    FOG: 'from-slate-400 to-slate-300',
    LIGHT_FOG: 'from-slate-400 to-slate-300',
    DRIZZLE: 'from-slate-500 to-blue-400',
    LIGHT_RAIN: 'from-slate-500 to-blue-400',
    RAIN: 'from-slate-600 to-blue-500',
    HEAVY_RAIN: 'from-slate-700 to-blue-600',
    SHOWERS: 'from-slate-500 to-blue-400',
    THUNDERSTORM: 'from-slate-800 to-purple-700',
    LIGHT_SNOW: 'from-slate-200 to-blue-100',
    SNOW: 'from-slate-300 to-blue-200',
    HEAVY_SNOW: 'from-slate-400 to-blue-300',
    UNKNOWN: 'from-blue-400 to-sky-300'
  }

  return backgroundMap[condition] ?? backgroundMap['UNKNOWN']!
}
