import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

// ── Config ────────────────────────────────────────────────────────────────────

const SMTP_HOST = process.env.SMTP_HOST ?? ''
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '587', 10)
const SMTP_USER = process.env.SMTP_USER ?? ''
const SMTP_PASS = process.env.SMTP_PASS ?? ''
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'noreply@vertice.co'
const NODE_ENV   = process.env.NODE_ENV ?? 'development'

// ── Transporter ───────────────────────────────────────────────────────────────

let _transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (_transporter) return _transporter

  if (NODE_ENV === 'test') {
    // In tests return a stub that captures calls without network
    _transporter = { sendMail: async () => ({ messageId: 'test' }) } as unknown as Transporter
    return _transporter
  }

  if (!SMTP_HOST) {
    // Dev fallback: log to console, don't throw
    _transporter = {
      sendMail: async (opts: { to: string; subject: string; html: string }) => {
        console.info('[email:dev] To=%s Subject=%s', opts.to, opts.subject)
        return { messageId: 'dev' }
      },
    } as unknown as Transporter
    return _transporter
  }

  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  return _transporter
}

// ── Send helpers ──────────────────────────────────────────────────────────────

interface SendResult {
  messageId: string
}

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  const info = await getTransporter().sendMail({ from: EMAIL_FROM, to, subject, html })
  return { messageId: info.messageId as string }
}

// ── Templates ─────────────────────────────────────────────────────────────────

const BASE_STYLE = `
  font-family: 'DM Mono', monospace, sans-serif;
  background: #050508;
  color: #F0EDE8;
  max-width: 560px;
  margin: 0 auto;
  padding: 40px 32px;
`

const GOLD = '#C8A84B'

function wrap(content: string): string {
  return `<!DOCTYPE html><html lang="es"><body>
    <div style="${BASE_STYLE}">
      <div style="margin-bottom:32px;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" width="120" height="40" fill="none">
          <polygon points="20,2 36,36 4,36" stroke="${GOLD}" stroke-width="1.5" fill="none"/>
          <text x="44" y="18" font-size="10" font-weight="700" letter-spacing="3" fill="${GOLD}">VÉRTICE OS</text>
          <text x="44" y="30" font-size="7" fill="rgba(240,237,232,0.45)" letter-spacing="2">SISTEMA OPERATIVO CÍVICO</text>
        </svg>
      </div>
      ${content}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:32px 0"/>
      <p style="font-size:11px;color:rgba(240,237,232,0.35);margin:0;">
        Cartagena de Indias · CTG One Corporation<br/>
        Tus datos están protegidos bajo la Ley 1581 de 2012 (Habeas Data Colombia)
      </p>
    </div>
  </body></html>`
}

// ── Exported send functions ───────────────────────────────────────────────────

export async function sendEmailVerification(
  to: string,
  token: string,
): Promise<SendResult> {
  const verifyUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? 'https://vertice.co'}/dashboard/identity?token=${token}`

  return send(
    to,
    'Verifica tu email — VÉRTICE OS',
    wrap(`
      <h1 style="font-size:20px;font-weight:700;color:#F0EDE8;margin:0 0 8px;">
        Verifica tu dirección de email
      </h1>
      <p style="font-size:13px;color:rgba(240,237,232,0.6);margin:0 0 24px;">
        Para completar tu identidad cívica digital, confirma tu email.
        Este enlace expira en <strong style="color:${GOLD}">15 minutos</strong>.
      </p>
      <a href="${verifyUrl}"
         style="display:inline-block;background:${GOLD};color:#050508;font-weight:700;
                font-size:12px;letter-spacing:2px;text-transform:uppercase;
                text-decoration:none;padding:14px 28px;">
        VERIFICAR EMAIL
      </a>
      <p style="font-size:11px;color:rgba(240,237,232,0.35);margin:24px 0 0;">
        O copia este token manualmente en la app:<br/>
        <code style="color:${GOLD};letter-spacing:1px;">${token}</code>
      </p>
    `),
  )
}

export async function sendPasswordReset(
  to: string,
  token: string,
): Promise<SendResult> {
  const resetUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? 'https://vertice.co'}/auth/reset-password?token=${token}`

  return send(
    to,
    'Restablecer contraseña — VÉRTICE OS',
    wrap(`
      <h1 style="font-size:20px;font-weight:700;color:#F0EDE8;margin:0 0 8px;">
        Restablece tu contraseña
      </h1>
      <p style="font-size:13px;color:rgba(240,237,232,0.6);margin:0 0 24px;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta.
        Este enlace expira en <strong style="color:${GOLD}">30 minutos</strong>.
        Si no lo solicitaste, puedes ignorar este mensaje.
      </p>
      <a href="${resetUrl}"
         style="display:inline-block;background:${GOLD};color:#050508;font-weight:700;
                font-size:12px;letter-spacing:2px;text-transform:uppercase;
                text-decoration:none;padding:14px 28px;">
        RESTABLECER CONTRASEÑA
      </a>
    `),
  )
}
