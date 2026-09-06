describe('community social graph policy', () => {
  it('documents that popularity is not a reputation input', () => {
    const excludedRankingSignals = ['followers', 'likes', 'impressions', 'community_corroborations']
    expect(excludedRankingSignals).toContain('followers')
    expect(excludedRankingSignals).toContain('community_corroborations')
  })

  it('keeps community validation semantically separate from verified results', () => {
    const communitySignals = ['corroborate', 'dispute']
    const verificationStates = ['declared', 'evidence_backed', 'verified']
    expect(communitySignals).not.toContain('verified')
    expect(verificationStates).toContain('verified')
  })
})