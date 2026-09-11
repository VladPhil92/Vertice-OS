import { z } from 'zod'

export const PilotEventNameSchema = z.enum([
  'session_started',
  'onboarding_completed',
  'territory_selected',
  'community_loaded',
  'follow_completed',
  'report_submitted',
  'proposal_explored',
  'workflow_opened',
  'moderation_report_submitted',
  'account_deletion_started',
  'account_deletion_completed',
  'feedback_opened',
  'feedback_submitted',
])

export const PilotSurfaceSchema = z.enum([
  'auth',
  'onboarding',
  'territory',
  'community',
  'reports',
  'governance',
  'workflows',
  'moderation',
  'account',
  'feedback',
])

export const PilotOutcomeSchema = z.enum(['success', 'failure', 'abandoned'])
export const PilotPlatformSchema = z.enum(['web', 'pwa'])

export const PilotTelemetrySchema = z.object({
  event: PilotEventNameSchema,
  surface: PilotSurfaceSchema,
  outcome: PilotOutcomeSchema,
  platform: PilotPlatformSchema,
  duration_ms: z.number().int().min(0).max(600_000).optional(),
}).strict()

export const PilotFeedbackSchema = z.object({
  category: z.enum(['usability', 'bug', 'trust_safety', 'performance', 'idea', 'other']),
  rating: z.number().int().min(1).max(5).optional(),
  surface: PilotSurfaceSchema,
  message: z.string().trim().min(1).max(500),
}).strict()

export const PilotIncidentSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  code: z.string().trim().min(3).max(64).regex(/^[A-Z0-9_:-]+$/),
  summary: z.string().trim().min(8).max(240),
  action: z.enum(['observe', 'degrade', 'pause_pilot', 'stop_pilot']),
}).strict()

export const PilotActivationCommandSchema = z.object({
  action: z.enum(['activate', 'pause']),
  expected_revision: z.string().regex(/^[0-9a-f]{40}$/i),
}).strict()

export type PilotTelemetryInput = z.infer<typeof PilotTelemetrySchema>
export type PilotFeedbackInput = z.infer<typeof PilotFeedbackSchema>
export type PilotIncidentInput = z.infer<typeof PilotIncidentSchema>
export type PilotActivationCommandInput = z.infer<typeof PilotActivationCommandSchema>
