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
  media_urls: string[]
  created_at: Date
  updated_at: Date
  resolved_at: Date | null
}

export interface ReportSummary {
  id: string
  category: ReportCategory
  title: string
  lat: number
  lng: number
  neighborhood: string | null
  status: ReportStatus
  urgency_score: number | null
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

export interface TerritorialStats {
  by_category: CategoryStats[]
  total_reports: number
  open_reports: number
}

// Fila raw devuelta por $queryRaw — campos con casts explícitos a float8/int
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
  media_urls: string[]
  created_at: Date
  updated_at: Date
  resolved_at: Date | null
  distance_meters?: number
}
