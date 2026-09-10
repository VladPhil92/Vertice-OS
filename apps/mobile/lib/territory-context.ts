import * as Location from 'expo-location'
import { apiFetch, apiMutation } from './api'

export interface TerritoryOption {
  code: string
  external_code: string | null
  name: string
  level: 'municipality' | 'district'
  parent_code: string | null
  country_code: string
  activation_status?: string
}

export interface MobileTerritoryContext {
  home: {
    territory_code: string | null
    territory_name: string | null
    territory_level: string | null
    department_code: string | null
    department_name: string | null
    context_role: 'home'
  }
  active: {
    territory_code: string
    territory_name: string
    territory_level: 'municipality' | 'district'
    department_code: string | null
    department_name: string | null
    source: 'manual' | 'gps' | 'home_fallback'
    is_home_fallback: boolean
  } | null
}

export async function searchNationalTerritories(query: string): Promise<TerritoryOption[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const params = new URLSearchParams({ q, limit: '40' })
  const response = await apiFetch<{ data: TerritoryOption[] }>(`/territories?${params.toString()}`, { public: true })
  return response.data.filter((territory) =>
    territory.country_code === 'CO'
    && (territory.level === 'municipality' || territory.level === 'district'),
  )
}

export async function loadTerritoryContext(): Promise<MobileTerritoryContext> {
  return apiFetch<MobileTerritoryContext>('/territories/context')
}

export async function setActiveTerritory(
  territoryCode: string,
  source: 'manual' | 'gps',
): Promise<MobileTerritoryContext> {
  return apiMutation<MobileTerritoryContext>('/territories/context', 'mobile-territory-context', {
    method: 'PUT',
    body: JSON.stringify({ active_territory_code: territoryCode, source }),
  })
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export type TerritoryGpsSuggestion =
  | { status: 'matched'; territory: TerritoryOption }
  | { status: 'outside_colombia' }
  | { status: 'unresolved' }

/**
 * Reverse geocoding is used only to suggest a canonical DANE/DIVIPOLA target.
 * Raw coordinates are not stored in the citizen territory context.
 */
export async function suggestTerritoryFromCoordinates(
  lat: number,
  lng: number,
): Promise<TerritoryGpsSuggestion> {
  const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
  const place = places[0]
  if (!place) return { status: 'unresolved' }

  if (place.isoCountryCode && place.isoCountryCode.toUpperCase() !== 'CO') {
    return { status: 'outside_colombia' }
  }

  const candidates = [place.city, place.subregion, place.region]
    .filter((value): value is string => Boolean(value && value.trim().length >= 2))

  for (const candidate of candidates) {
    const territories = await searchNationalTerritories(candidate)
    const wanted = normalize(candidate)
    const match = territories.find((territory) => {
      const name = normalize(territory.name)
      return name === wanted || name.startsWith(wanted) || wanted.startsWith(name)
    }) ?? territories[0]
    if (match) return { status: 'matched', territory: match }
  }

  return { status: 'unresolved' }
}
