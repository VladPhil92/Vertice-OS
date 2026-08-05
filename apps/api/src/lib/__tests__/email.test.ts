import { sendEmailVerification, sendPasswordReset } from '../email'

// email.ts creates the transporter lazily; in NODE_ENV=test it uses a stub
// that captures calls without network, so we just verify the return shape.

describe('sendEmailVerification', () => {
  it('resolves with a messageId', async () => {
    const result = await sendEmailVerification('user@example.com', 'tok123')
    expect(result).toHaveProperty('messageId')
    expect(typeof result.messageId).toBe('string')
  })
})

describe('sendPasswordReset', () => {
  it('resolves with a messageId', async () => {
    const result = await sendPasswordReset('user@example.com', 'tok456')
    expect(result).toHaveProperty('messageId')
    expect(typeof result.messageId).toBe('string')
  })
})
