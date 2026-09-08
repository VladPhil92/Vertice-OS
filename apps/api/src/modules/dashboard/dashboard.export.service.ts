import { getCitizenCommandCenter } from './dashboard.service'

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export async function buildCitizenOperationalCsv(citizenId: string): Promise<string> {
  const dashboard = await getCitizenCommandCenter(citizenId)
  const rows: Array<[string, string, unknown]> = [
    ['perfil', 'barrio', dashboard.profile.neighborhood ?? ''],
    ['perfil', 'nivel_verificacion', dashboard.profile.verification_level],
    ['participacion_historica', 'score', dashboard.reputation.score],
    ['participacion_historica', 'votos', dashboard.reputation.total_votes],
    ['participacion_historica', 'propuestas', dashboard.reputation.total_proposals],
    ['participacion_historica', 'reportes', dashboard.reputation.total_reports],
    ['atencion', 'items_totales', dashboard.attention.total_items],
    ['atencion', 'votos_pendientes', dashboard.attention.pending_votes.length],
    ['atencion', 'acciones_sin_evidencia', dashboard.attention.civic_actions_needing_evidence],
    ['gestion', 'acciones_total', dashboard.mine.civic_actions.total],
    ['gestion', 'acciones_activas', dashboard.mine.civic_actions.active],
    ['gestion', 'acciones_verificadas', dashboard.mine.civic_actions.verified],
    ['gestion', 'reportes_total', dashboard.mine.reports.total],
    ['gestion', 'propuestas_total', dashboard.mine.proposals.total],
    ['gestion', 'expedientes_total', dashboard.mine.workflows.total],
    ['gestion', 'expedientes_activos', dashboard.mine.workflows.active],
  ]

  return [
    ['seccion', 'metrica', 'valor'].map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\n')
}
