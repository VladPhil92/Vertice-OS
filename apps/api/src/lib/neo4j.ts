import type { Driver, Session } from 'neo4j-driver';
import neo4j from 'neo4j-driver'
import { config } from '../config'

let _driver: Driver | null = null

export function getNeo4jDriver(): Driver {
  if (!_driver) {
    _driver = neo4j.driver(
      config.NEO4J_URI,
      neo4j.auth.basic(config.NEO4J_USER, config.NEO4J_PASSWORD),
      {
        maxConnectionPoolSize: 50,
        connectionTimeout: 5000,
      }
    )
  }
  return _driver
}

export async function closeNeo4j(): Promise<void> {
  if (_driver) {
    await _driver.close()
    _driver = null
  }
}

export function neo4jSession(): Session {
  return getNeo4jDriver().session({ database: config.NEO4J_DATABASE })
}

export async function runCypher<T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session = neo4jSession()
  try {
    const result = await session.run(query, params)
    return result.records.map((r) => r.toObject() as T)
  } finally {
    await session.close()
  }
}
