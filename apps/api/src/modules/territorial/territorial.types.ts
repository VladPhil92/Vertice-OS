export const REPORT_CATEGORIES = [
  'infraestructura',
  'servicios_publicos',
  'seguridad',
  'medio_ambiente',
  'transporte',
  'salud',
  'educacion',
  'cultura',
  'otro',
] as const

export const REPORT_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'rejected',
  'duplicate',
] as const

export const REPORT_TERRITORY_SOURCES = ['manual', 'gps'] as const
export const REPORT_TERRITORY_VALIDATIONS = [
  'polygon_verified',
  'border_tolerance',
  'catalog_unavailable',
  'legacy_unverified',
] as const

export type ReportTerritorySource = (typeof REPORT_TERRITORY_SOURCES)[number]
export type StoredReportTerritorySource = ReportTerritorySource | 'legacy_home_fallback'
export type ReportTerritoryValidation = (typeof REPORT_TERRITORY_VALIDATIONS)[number]
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export interface TerritorialReport {
  id: string
  citizen_id: string | null
  category: ReportCategory
  subcategory: string | null
  title: string
  description: string
  lat: number
  lng: number
  neighborhood: string | null
  locality_id: number | null
  address_reference: string | null
  urgency_score: number | null
  status: ReportStatus
  territory_code: string | null
  territory_name: string | null
  department_code: string | null
  department_name: string | null
  territory_source: StoredReportTerritorySource | null
  territory_validation: ReportTerritoryValidation | null
  territory_boundary_version: string | null
  media_urls: string[]
  created_at: Date
  updated_at: Date
  resolved_at: Date | null
}

export interface ReportSummary {
  id: string
  category: ReportCategory
  title: string
  description?: string
  lat: number
  lng: number
  neighborhood: string | null
  status: ReportStatus
  urgency_score: number | null
  territory_code: string | null
  territory_name: string | null
  department_code: string | null
  department_name: string | null
  territory_source: StoredReportTerritorySource | null
  territory_validation: ReportTerritoryValidation | null
  territory_boundary_version: string | null
  media_urls: string[]
  created_at: Date
}

export interface NearbyReport extends ReportSummary {
  description: string
  distance_meters: number
}

export interface CategoryStats {
  category: string
  total: number
  open_count: number
  resolved_count: number
  avg_urgency: number | null
}

export interface TerritoryStats {
  territory_code: string
  territory_name: string
  department_code: string | null
  department_name: string | null
  total: number
  open_count: number
  resolved_count: number
  avg_urgency: number | null
}

export interface TerritorialStats {
  by_category: CategoryStats[]
  by_territory: TerritoryStats[]
  total_reports: number
  open_reports: number
}

export interface ReportRow {
  id: string
  citizen_id: string | null
  category: string
  subcategory: string | null
  title: string
  description: string
  lat: number
  lng: number
  neighborhood: string | null
  locality_id: number | null
  address_reference: string | null
  urgency_score: number | null
  status: string
  territory_code?: string | null
  territory_name?: string | null
  department_code?: string | null
  department_name?: string | null
  territory_source?: string | null
  territory_validation?: string | null
  territory_boundary_version?: string | null
  media_urls: string[]
  created_at: Date
  updated_at: Date
  resolved_at: Date | null
  distance_meters?: number
}
