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

interface DepartmentOption {
  code: string
  name: string
  level: 'department'
  country_code: string
}

interface BoundaryResolution {
  status: 'matched' | 'near_border' | 'ambiguous_border' | 'outside_colombia' | 'catalog_unavailable' | 'unresolved'
  territory?: TerritoryOption
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

function nameMatchesCandidate(name: string, candidate: string): boolean {
  const normalizedName = normalize(name)
  const normalizedCandidate = normalize(candidate)
  return normalizedName === normalizedCandidate
    || normalizedName.startsWith(normalizedCandidate)
    || normalizedCandidate.startsWith(normalizedName)
}

async function resolveDepartmentCode(region: string | null): Promise<string | null> {
  const q = region?.trim()
  if (!q || q.length < 2) return null

  const params = new URLSearchParams({ q, level: 'department', limit: '20' })
  const response = await apiFetch<{ data: DepartmentOption[] }>(`/territories?${params.toString()}`, { public: true })
  const candidates = response.data.filter((department) =>
    department.country_code === 'CO'
    && department.level === 'department'
    && nameMatchesCandidate(department.name, q),
  )
  const [department] = candidates

  return candidates.length === 1 && department ? department.code : null
}

export type TerritoryGpsSuggestion =
  | { status: 'matched'; territory: TerritoryOption }
  | { status: 'outside_colombia' }
  | { status: 'unresolved' }

async function suggestFromDeviceReverseGeocode(lat: number, lng: number): Promise<TerritoryGpsSuggestion> {
  const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
  const place = places[0]
  if (!place) return { status: 'unresolved' }

  if (place.isoCountryCode && place.isoCountryCode.toUpperCase() !== 'CO') {
    return { status: 'outside_colombia' }
  }

  const departmentCode = await resolveDepartmentCode(place.region)
  const municipalityCandidates = [place.city, place.subregion]
    .filter((value): value is string => Boolean(value && value.trim().length >= 2))
    .filter((value, index, values) => values.findIndex((item) => normalize(item) === normalize(value)) === index)

  for (const candidate of municipalityCandidates) {
    const territories = await searchNationalTerritories(candidate)
    const exactMatches = territories.filter((territory) => normalize(territory.name) === normalize(candidate))
    const nameMatches = exactMatches.length > 0
      ? exactMatches
      : territories.filter((territory) => nameMatchesCandidate(territory.name, candidate))

    const scopedMatches = departmentCode
      ? nameMatches.filter((territory) => territory.parent_code === departmentCode)
      : nameMatches
    const [match] = scopedMatches

    if (scopedMatches.length === 1 && match) return { status: 'matched', territory: match }
    if (scopedMatches.length > 1 || (!departmentCode && nameMatches.length > 1)) {
      return { status: 'unresolved' }
    }
  }

  return { status: 'unresolved' }
}

/**
 * Prefer the API's locally synchronized DANE polygons because municipality names
 * are not globally unique and reverse-geocoder labels vary by device provider.
 *
 * Exact coordinates are sent in a POST body rather than the request URL so API
 * URL telemetry cannot become a passive movement-history trail. If the boundary
 * resolver is unavailable, the department-aware device reverse-geocoder remains
 * an availability fallback. Ambiguous polygon borders never guess.
 */
export async function suggestTerritoryFromCoordinates(
  lat: number,
  lng: number,
): Promise<TerritoryGpsSuggestion> {
  try {
    const resolution = await apiFetch<BoundaryResolution>('/territories/resolve', {
      method: 'POST',
      public: true,
      body: JSON.stringify({ lat, lng }),
    })

    if ((resolution.status === 'matched' || resolution.status === 'near_border') && resolution.territory) {
      return { status: 'matched', territory: resolution.territory }
    }
    if (resolution.status === 'outside_colombia') return { status: 'outside_colombia' }
    if (resolution.status === 'ambiguous_border' || resolution.status === 'unresolved') {
      return { status: 'unresolved' }
    }
  } catch {
    // Fall through to the device provider; participation must remain available
    // while the server boundary resolver is degraded.
  }

  return suggestFromDeviceReverseGeocode(lat, lng)
}
