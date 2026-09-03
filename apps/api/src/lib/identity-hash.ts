import { createHmac } from 'crypto'
import { getIdentityPepper } from './feature-secrets'

/**
 * Hash de la cédula para deduplicación, NUNCA como prueba de identidad.
 *
 * Antes era SHA-256(cedula) sin sal: el espacio de números de cédula
 * colombianos es pequeño y enumerable, así que si la base de datos se filtra,
 * un atacante puede generar millones de candidatos, hashearlos y recuperar
 * gran parte de las cédulas reales por fuerza bruta. Un hash sin secreto no
 * protege nada frente a ese ataque.
 *
 * HMAC con un pepper fuera de la base de datos cierra esa vía: sin el
 * pepper, un atacante con la base filtrada no puede probar candidatos.
 *
 * En producción nunca se reutiliza JWT_SECRET: si IDENTITY_PEPPER falta, solo
 * las operaciones que necesitan hash de documento fallan cerradas con 503,
 * mientras el resto del API puede seguir disponible.
 */
export function hashCedula(cedula: string): string {
  const normalized = cedula.trim()
  return createHmac('sha256', getIdentityPepper()).update(normalized).digest('hex')
}