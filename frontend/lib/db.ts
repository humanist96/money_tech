import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL!

export function getDb() {
  return neon(DATABASE_URL)
}
