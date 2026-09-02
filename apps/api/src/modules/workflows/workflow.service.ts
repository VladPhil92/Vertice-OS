import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { analyzeTerritorial, draftPolicy } from '../ai/ai.service'
import { createProposal } from '../governance/governance.service'
import {
  PROPOSAL_CATEGORIES,
  type ProposalCategory,
} from '../governance/governance.types'
import { createLegalDocument } from '../legal/legal.service'
import { getReportById } from '../territorial/territorial.service'
import type { TerritorialReport } from '../territorial/territorial.types'
import type { EscalateControlInput, EscalateProposalInput } from './workflow.schema'

interface CivicCaseRow {
  id: string
  citizen_id: string
  source_report_id: string
  proposal_id: string | null
  legal_document_id: string | null
  stage: string
  territorial_analysis: unknown | null
  territorial_analysis_audit_id: string | null
  policy_draft: unknown | null
  policy_draft_audit_id: string | null
  created_at: Date
  updated_at: Date
  report_title: string
  report_category: string
  report_status: string
  report_neighborhood: string | null
  report_created_at: Date
  proposal_title: string | null
  proposal_status: string | null
  proposal_scope: string | null
  proposal_voting_ends_at: Date | null
  legal_type: string | null
  legal_status: string | null
  legal_urgency: string | null
  legal_submitted_at: Date | null
}

const PROPOSAL_CATEGORY_SET = new Set<string>(PROPOSAL_CATEGORIES)

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function proposalCategoryFor(reportCategory: string): ProposalCategory {
  if (reportCategory === 'transporte') return 'movilidad'
  if (PROPOSAL_CATEGORY_SET.has(reportCategory)) return reportCategory as ProposalCategory
  return 'otro'
}

function deriveStage(row: CivicCaseRow): string {
  if (row.legal_document_id) {
    if (row.legal_status === 'submitted' || row.legal_status === 'responded' || row.legal_status === 'escalated') {
      return 'control'
    }
  }

  if (row.proposal_id) {
    if (row.proposal_status === 'voting') return 'voting'
    if (row.proposal_status === 'debate') return 'deliberation'
    if (['approved', 'rejected', 'quorum_failed', 'executed', 'failed_execution'].includes(row.proposal_status ?? '')) {
      return 'decision'
    }
    return 'proposal'
  }

  if (row.territorial_analysis_audit_id) return 'analysis'
  return row.stage === 'proposal_drafting' || row.stage === 'control_drafting' ? row.stage : 'reported'
}

function serializeCase(row: CivicCaseRow) {
  return {
    id: row.id,
    stage: deriveStage(row),
    stored_stage: row.stage,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    report: {
      id: row.source_report_id,
      title: row.report_title,
      category: row.report_category,
      status: row.report_status,
      neighborhood: row.report_neighborhood,
      created_at: row.report_created_at.toISOString(),
    },
    analysis: row.territorial_analysis_audit_id
      ? {
          audit_id: row.territorial_analysis_audit_id,
          result: row.territorial_analysis,
        }
      : null,
    proposal: row.proposal_id
      ? {
          id: row.proposal_id,
          title: row.proposal_title,
          status: row.proposal_status,
          scope: row.proposal_scope,
          voting_ends_at: row.proposal_voting_ends_at?.toISOString() ?? null,
          policy_draft_audit_id: row.policy_draft_audit_id,
        }
      : null,
    control: row.legal_document_id
      ? {
          id: row.legal_document_id,
          legal_type: row.legal_type,
          status: row.legal_status,
          urgency: row.legal_urgency,
          submitted_at: row.legal_submitted_at?.toISOString() ?? null,
        }
      : null,
  }
}

async function fetchCaseRows(citizenId: string, extraWhere: Prisma.Sql, limit = 50): Promise<CivicCaseRow[]> {
  return prisma.$queryRaw<CivicCaseRow[]>(Prisma.sql`
    SELECT
      c.id::text,
      c.citizen_id::text,
      c.source_report_id::text,
      c.proposal_id::text,
      c.legal_document_id::text,
      c.stage,
      c.territorial_analysis,
      c.territorial_analysis_audit_id,
      c.policy_draft,
      c.policy_draft_audit_id,
      c.created_at,
      c.updated_at,
      r.title AS report_title,
      r.category AS report_category,
      r.status AS report_status,
      r.neighborhood AS report_neighborhood,
      r.created_at AS report_created_at,
      p.title AS proposal_title,
      p.status AS proposal_status,
      p.scope AS proposal_scope,
      p.voting_ends_at AS proposal_voting_ends_at,
      l.legal_type,
      l.status AS legal_status,
      l.urgency AS legal_urgency,
      l.submitted_at AS legal_submitted_at
    FROM civic_cases c
    INNER JOIN territorial_reports r ON r.id = c.source_report_id
    LEFT JOIN proposals p ON p.id = c.proposal_id
    LEFT JOIN legal_documents l ON l.id = c.legal_document_id
    WHERE c.citizen_id = ${citizenId}::uuid
      AND ${extraWhere}
    ORDER BY c.updated_at DESC
    LIMIT ${limit}
  `)
}

async function ownedReport(citizenId: string, reportId: string): Promise<TerritorialReport> {
  const report = await getReportById(reportId)
  if (report.citizen_id !== citizenId) {
    throw makeError('Solo puedes escalar reportes creados por ti', 403, 'NOT_REPORT_OWNER')
  }
  return report
}

async function ensureCase(citizenId: string, report: TerritorialReport): Promise<CivicCaseRow> {
  await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO civic_cases (citizen_id, source_report_id, stage)
    VALUES (${citizenId}::uuid, ${report.id}::uuid, 'reported')
    ON CONFLICT (source_report_id) DO NOTHING
    RETURNING id::text
  `)

  const rows = await fetchCaseRows(citizenId, Prisma.sql`c.source_report_id = ${report.id}::uuid`, 1)
  if (!rows[0]) throw makeError('No fue posible abrir el expediente cívico', 500, 'CIVIC_CASE_CREATE_FAILED')
  return rows[0]
}

async function refreshCase(citizenId: string, caseId: string): Promise<ReturnType<typeof serializeCase>> {
  const rows = await fetchCaseRows(citizenId, Prisma.sql`c.id = ${caseId}::uuid`, 1)
  if (!rows[0]) throw makeError('Expediente cívico no encontrado', 404, 'CIVIC_CASE_NOT_FOUND')
  return serializeCase(rows[0])
}

export async function listCivicCases(citizenId: string, limit = 10) {
  const rows = await fetchCaseRows(citizenId, Prisma.sql`TRUE`, limit)
  return rows.map(serializeCase)
}

export async function getCivicCase(citizenId: string, caseId: string) {
  return refreshCase(citizenId, caseId)
}

export async function getCivicCaseForReport(citizenId: string, reportId: string) {
  await ownedReport(citizenId, reportId)
  const rows = await fetchCaseRows(citizenId, Prisma.sql`c.source_report_id = ${reportId}::uuid`, 1)
  return rows[0] ? serializeCase(rows[0]) : null
}

export async function analyzeReportWorkflow(citizenId: string, reportId: string) {
  const report = await ownedReport(citizenId, reportId)
  const civicCase = await ensureCase(citizenId, report)

  const result = await analyzeTerritorial({
    reports: [{
      id: report.id,
      category: report.category,
      title: report.title,
      description: report.description,
      urgency_score: report.urgency_score ?? 0.5,
      status: report.status,
      neighborhood: report.neighborhood ?? undefined,
    }],
    neighborhood: report.neighborhood ?? undefined,
    citizen_id: citizenId,
  })

  await prisma.$queryRaw(Prisma.sql`
    UPDATE civic_cases
    SET territorial_analysis = ${JSON.stringify(result)}::jsonb,
        territorial_analysis_audit_id = ${result.audit_id},
        stage = 'analysis',
        updated_at = NOW()
    WHERE id = ${civicCase.id}::uuid
      AND citizen_id = ${citizenId}::uuid
  `)

  return {
    analysis: result,
    case: await refreshCase(citizenId, civicCase.id),
  }
}

export async function createProposalFromReport(
  citizenId: string,
  reportId: string,
  input: EscalateProposalInput,
) {
  const report = await ownedReport(citizenId, reportId)
  const civicCase = await ensureCase(citizenId, report)
  if (civicCase.proposal_id) {
    throw makeError('Este expediente ya tiene una propuesta vinculada', 409, 'CASE_PROPOSAL_EXISTS')
  }

  const category = input.category ?? proposalCategoryFor(report.category)
  const policy = await draftPolicy({
    citizen_demand: report.description,
    category,
    scope: input.scope,
    territory: report.neighborhood ?? undefined,
    citizen_id: citizenId,
  })

  const draft = policy.draft.trim().length >= 50
    ? policy.draft.trim()
    : `${policy.draft.trim()}\n\nContexto ciudadano: ${report.description}`

  const proposal = await createProposal(citizenId, {
    title: (input.title ?? `Solución ciudadana: ${report.title}`).slice(0, 200),
    description: draft.slice(0, 10_000),
    executive_summary: report.description.slice(0, 500),
    category,
    scope: input.scope,
  })

  await prisma.$queryRaw(Prisma.sql`
    UPDATE civic_cases
    SET proposal_id = ${proposal.id}::uuid,
        policy_draft = ${JSON.stringify(policy)}::jsonb,
        policy_draft_audit_id = ${policy.audit_id},
        stage = 'proposal',
        updated_at = NOW()
    WHERE id = ${civicCase.id}::uuid
      AND citizen_id = ${citizenId}::uuid
      AND proposal_id IS NULL
  `)

  return {
    proposal,
    policy_draft: policy,
    case: await refreshCase(citizenId, civicCase.id),
  }
}

export async function createControlFromReport(
  citizenId: string,
  reportId: string,
  input: EscalateControlInput,
) {
  const report = await ownedReport(citizenId, reportId)
  const civicCase = await ensureCase(citizenId, report)
  if (civicCase.legal_document_id) {
    throw makeError('Este expediente ya tiene una actuación de control vinculada', 409, 'CASE_CONTROL_EXISTS')
  }

  const document = await createLegalDocument(citizenId, {
    situation_description: report.description,
    evidence_description: input.evidence_description
      ?? `Caso originado en el reporte territorial ${report.id}: ${report.title}`,
    location: report.address_reference ?? report.neighborhood ?? undefined,
    evidence_urls: report.media_urls,
    category: input.category ?? report.category,
  })

  await prisma.$queryRaw(Prisma.sql`
    UPDATE civic_cases
    SET legal_document_id = ${document.id}::uuid,
        stage = 'control',
        updated_at = NOW()
    WHERE id = ${civicCase.id}::uuid
      AND citizen_id = ${citizenId}::uuid
      AND legal_document_id IS NULL
  `)

  return {
    document,
    case: await refreshCase(citizenId, civicCase.id),
  }
}
