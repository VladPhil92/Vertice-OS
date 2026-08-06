import { createHmac } from 'crypto'
import { config } from '../config'

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
 * En producción IDENTITY_PEPPER es obligatorio (ver config.ts). El fallback a
 * JWT_SECRET solo cubre desarrollo local — nunca debe usarse así en producción,
 * porque reutilizar JWT_SECRET aquí anula la separación de dominios
 * criptográficos que el pepper dedicado existe para dar.
 */
export function hashCedula(cedula: string): string {
  const pepper = config.IDENTITY_PEPPER ?? config.JWT_SECRET
  const normalized = cedula.trim()
  return createHmac('sha256', pepper).update(normalized).digest('hex')
}
