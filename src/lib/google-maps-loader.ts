// Shared Google Maps script loader to prevent multiple script loading conflicts

type LoaderCallback = () => void

interface LoaderState {
  isLoading: boolean
  isLoaded: boolean
  error: string | null
  callbacks: LoaderCallback[]
}

const state: LoaderState = {
  isLoading: false,
  isLoaded: false,
  error: null,
  callbacks: []
}

declare global {
  interface Window {
    google: typeof google
    __googleMapsCallback: () => void
  }
}

export function loadGoogleMaps(options?: { libraries?: string[] }): Promise<typeof google> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (state.isLoaded && window.google?.maps) {
      resolve(window.google)
      return
    }

    // Error occurred previously
    if (state.error) {
      reject(new Error(state.error))
      return
    }

    // Add callback for when loaded
    const callback = () => {
      if (state.error) {
        reject(new Error(state.error))
      } else {
        resolve(window.google)
      }
    }
    state.callbacks.push(callback)

    // Already loading, just wait for callback
    if (state.isLoading) {
      return
    }

    // Start loading
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      state.error = 'Google Maps API key not configured'
      state.callbacks.forEach(cb => cb())
      state.callbacks = []
      return
    }

    // Check if script already exists (may have been loaded by another method)
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')
    if (existingScript) {
      // Wait for it to load
      if (window.google?.maps) {
        state.isLoaded = true
        state.callbacks.forEach(cb => cb())
        state.callbacks = []
        return
      }
      // Script exists but not loaded yet, wait for it
      const checkLoaded = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkLoaded)
          state.isLoaded = true
          state.callbacks.forEach(cb => cb())
          state.callbacks = []
        }
      }, 100)
      return
    }

    state.isLoading = true

    // Create global callback
    window.__googleMapsCallback = () => {
      state.isLoading = false
      state.isLoaded = true
      state.callbacks.forEach(cb => cb())
      state.callbacks = []
    }

    // Build URL with libraries
    const libraries = options?.libraries?.join(',') || 'places'
    const script = document.createElement('script')
    script.id = 'google-maps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries}&callback=__googleMapsCallback`
    script.async = true
    script.defer = true
    script.onerror = () => {
      state.isLoading = false
      state.error = 'Failed to load Google Maps'
      state.callbacks.forEach(cb => cb())
      state.callbacks = []
    }

    document.head.appendChild(script)
  })
}

export function isGoogleMapsLoaded(): boolean {
  return state.isLoaded && !!window.google?.maps
}

export function getGoogleMapsError(): string | null {
  return state.error
}
