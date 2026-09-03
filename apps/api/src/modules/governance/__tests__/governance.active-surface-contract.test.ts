import fs from 'fs'
import path from 'path'

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')
}

describe('governance active surface contract', () => {
  it('keeps public/admin routes disconnected from legacy vote and moderation engines', () => {
    const routes = source('governance.routes.ts')

    expect(routes).toContain('castVoteLedger')
    expect(routes).toContain('advanceProposalStageSafely')
    expect(routes).toContain('adminAdvanceProposalSafely')
    expect(routes).toContain('adminArchiveProposalSafely')

    expect(routes).not.toMatch(/\bcastVote\b/)
    expect(routes).not.toMatch(/\badminAdvanceProposal\b/)
    expect(routes).not.toMatch(/\badminArchiveProposal\b/)
    expect(routes).not.toMatch(/\badminListProposals\b/)
  })

  it('keeps administrative transition code on the hardened lifecycle entrypoint', () => {
    const adminTransition = source('governance.admin-transition.ts')

    expect(adminTransition).toContain("from './governance.lifecycle'")
    expect(adminTransition).toContain('advanceProposalStageSafely')
    expect(adminTransition).not.toMatch(/\badvanceProposalStage\b/)
  })
})
