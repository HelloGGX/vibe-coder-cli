import { readLockFile } from "../utils/config"
import type { VibeLockEntry } from "../types"

/**
 * Get all skills from the lock file
 * @param cwd - Optional working directory, defaults to process.cwd()
 * @returns Record of skill names to their lock entries
 */
export async function getAllLockedSkills(cwd?: string): Promise<Record<string, VibeLockEntry & { skillPath?: string }>> {
  const lock = readLockFile(cwd)
  return lock.skills ?? {}
}

/**
 * Get skills grouped by source for batch update operations
 * @param cwd - Optional working directory, defaults to process.cwd()
 * @returns Map of source URLs to skills and their entry data
 */
export async function getSkillsBySource(
  cwd?: string,
): Promise<Map<string, { skills: string[]; entry: VibeLockEntry & { skillPath?: string } }>> {
  const lock = readLockFile(cwd)
  const bySource = new Map<string, { skills: string[]; entry: VibeLockEntry & { skillPath?: string } }>()

  if (!lock.skills) {
    return bySource
  }

  for (const [skillName, entry] of Object.entries(lock.skills)) {
    const existing = bySource.get(entry.source)
    if (existing) {
      existing.skills.push(skillName)
    } else {
      bySource.set(entry.source, { skills: [skillName], entry })
    }
  }

  return bySource
}
