'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  fetchCurrentWeather,
  getWeatherIcon,
  type WeatherData
} from '@/lib/weather'
import type { ProfileExtended } from '@/types/database'
import Link from 'next/link'

export function WeatherWidget() {
  const { profile } = useAuth()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadWeather() {
      if (!profile) {
        setIsLoading(false)
        return
      }

      const extendedData = profile.notification_preferences as ProfileExtended | null

      if (!extendedData?.address_lat || !extendedData?.address_lng) {
        setError('no_address')
        setIsLoading(false)
        return
      }

      try {
        const result = await fetchCurrentWeather(
          extendedData.address_lat,
          extendedData.address_lng
        )

        if (result.error) {
          setError(result.error.message)
        } else if (result.data) {
          setWeather(result.data)
        }
      } catch {
        setError('Failed to load weather')
      } finally {
        setIsLoading(false)
      }
    }

    loadWeather()
  }, [profile])

  // No address set - prompt to add one
  if (error === 'no_address') {
    return (
      <div className="rounded-xl bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="material-icons text-blue-500">wb_sunny</span>
            Weather
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <span className="material-icons text-4xl text-muted-foreground">location_off</span>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your address to see local weather
          </p>
          <Link
            href="/profile"
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Update Profile
          </Link>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-xl bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="material-icons text-blue-500">wb_sunny</span>
            Weather
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <span className="material-icons animate-spin text-2xl text-primary">sync</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !weather) {
    return (
      <div className="rounded-xl bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="material-icons text-blue-500">wb_sunny</span>
            Weather
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <span className="material-icons text-4xl text-muted-foreground">cloud_off</span>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || 'Unable to load weather'}
          </p>
        </div>
      </div>
    )
  }

  const icon = getWeatherIcon(weather.condition, weather.isDaytime)

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-border">
      {/* Weather header with dark blue gradient background */}
      <div className="relative bg-gradient-to-br from-[#000542] via-[#1a2151] to-[#313A64] p-5 text-white">
        <div className="relative z-10">
          <p className="text-xs font-medium uppercase tracking-wide drop-shadow-sm">Current Weather</p>
          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="text-5xl font-bold drop-shadow-md">{weather.temperature}°C</span>
              <p className="text-sm mt-1 opacity-90 drop-shadow-sm">
                Feels like {weather.feelsLike}°C
              </p>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="material-icons text-7xl opacity-90">{icon}</span>
              <p className="text-sm capitalize mt-1">{weather.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Weather details */}
      <div className="bg-card p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <span className="material-icons text-blue-600 dark:text-blue-400">water_drop</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Humidity</p>
              <p className="font-semibold">{weather.humidity}%</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <span className="material-icons text-slate-600 dark:text-slate-400">air</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wind</p>
              <p className="font-semibold">{weather.windSpeed} km/h</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
              <span className="material-icons text-cyan-600 dark:text-cyan-400">umbrella</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Precipitation</p>
              <p className="font-semibold">{weather.precipitationProbability}%</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <span className="material-icons text-amber-600 dark:text-amber-400">wb_sunny</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">UV Index</p>
              <p className="font-semibold">{weather.uvIndex}</p>
            </div>
          </div>
        </div>

        {/* Last updated */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Updated {weather.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
