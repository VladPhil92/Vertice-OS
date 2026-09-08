import { z } from 'zod'
import { REPORT_CATEGORIES, REPORT_STATUSES } from './territorial.types'

const MediaAssetIdSchema = z.string().uuid()

export const CreateReportSchema = z.object({
  title: z.string().min(10, 'Mínimo 10 caracteres').max(200),
  description: z.string().min(20, 'Mínimo 20 caracteres').max(2000),
  category: z.enum(REPORT_CATEGORIES),
  subcategory: z.string().max(80).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  neighborhood: z.string().max(120).optional(),
  locality_id: z.number().int().positive().optional(),
  address_reference: z.string().max(300).optional(),
  urgency_score: z.number().min(0).max(1).optional(),
  // Legacy/read compatibility only. New evidence is attached through media_asset_ids.
  media_urls: z.array(z.string().url()).max(5).default([]),
  media_asset_ids: z.array(MediaAssetIdSchema).max(5).default([]),
})

export const ConfirmReportMediaSchema = z.object({
  media_asset_id: MediaAssetIdSchema,
})

export const AttachReportMediaSchema = z.object({
  media_asset_ids: z.array(MediaAssetIdSchema).min(1).max(5),
})

export const ReportIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const ListReportsSchema = z.object({
  category: z.enum(REPORT_CATEGORIES).optional(),
  status: z.enum(REPORT_STATUSES).optional(),
  locality_id: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const NearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().min(0.1).max(50).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export const UpdateStatusSchema = z.object({
  status: z.enum(REPORT_STATUSES),
  assigned_to: z.string().max(200).optional(),
})

// Input type keeps defaulted media fields optional for direct service callers/tests;
// Fastify routes receive the fully defaulted parsed output.
export type CreateReportInput = z.input<typeof CreateReportSchema>
export type AttachReportMediaInput = z.infer<typeof AttachReportMediaSchema>
export type ListReportsInput = z.infer<typeof ListReportsSchema>
export type NearbyInput = z.infer<typeof NearbySchema>
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>
