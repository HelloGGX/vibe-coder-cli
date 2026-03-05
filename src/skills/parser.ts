import { readdir, readFile, stat } from 'fs/promises'
import { join, basename, dirname } from 'path'
import matter from 'gray-matter'
import type { Skill } from '../types'

const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv']

/**
 * Check if a directory contains SKILL.md
 */
async function hasSkillMd(dir: string): Promise<boolean> {
  try {
    const skillPath = join(dir, 'SKILL.md')
    const stats = await stat(skillPath)
    return stats.isFile()
  } catch {
    return false
  }
}

/**
 * Parse a SKILL.md file and extract frontmatter
 */
export async function parseSkillMd(skillMdPath: string): Promise<Skill | null> {
  try {
    const content = await readFile(skillMdPath, 'utf-8')
    const { data } = matter(content)

    if (!data.name || !data.description) {
      return null
    }

    // Ensure name and description are strings
    if (typeof data.name !== 'string' || typeof data.description !== 'string') {
      return null
    }

    return {
      name: data.name,
      description: data.description,
      path: dirname(skillMdPath),
      rawContent: content,
      metadata: data.metadata
    }
  } catch {
    return null
  }
}

/**
 * Recursively find all directories containing SKILL.md
 */
async function findSkillDirs(dir: string, depth = 0, maxDepth = 5): Promise<string[]> {
  if (depth > maxDepth) return []

  try {
    const [hasSkill, entries] = await Promise.all([
      hasSkillMd(dir),
      readdir(dir, { withFileTypes: true }).catch(() => [])
    ])

    const currentDir = hasSkill ? [dir] : []

    // Search subdirectories in parallel
    const subDirResults = await Promise.all(
      entries
        .filter(entry => entry.isDirectory() && !SKIP_DIRS.includes(entry.name))
        .map(entry => findSkillDirs(join(dir, entry.name), depth + 1, maxDepth))
    )

    return [...currentDir, ...subDirResults.flat()]
  } catch {
    return []
  }
}

/**
 * Discover all skills in a directory
 */
export async function discoverSkills(basePath: string, subpath?: string): Promise<Skill[]> {
  const skills: Skill[] = []
  const seenNames = new Set<string>()
  const searchPath = subpath ? join(basePath, subpath) : basePath

  // If pointing directly at a skill, add it
  if (await hasSkillMd(searchPath)) {
    const skill = await parseSkillMd(join(searchPath, 'SKILL.md'))
    if (skill) {
      skills.push(skill)
      seenNames.add(skill.name)
      return skills
    }
  }

  // Search common skill locations first
  const prioritySearchDirs = [
    searchPath,
    join(searchPath, 'skills'),
    join(searchPath, '.opencode/skills'),
    join(searchPath, '.agents/skills')
  ]

  for (const dir of prioritySearchDirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = join(dir, entry.name)
          if (await hasSkillMd(skillDir)) {
            const skill = await parseSkillMd(join(skillDir, 'SKILL.md'))
            if (skill && !seenNames.has(skill.name)) {
              skills.push(skill)
              seenNames.add(skill.name)
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  // Fall back to recursive search if nothing found
  if (skills.length === 0) {
    const allSkillDirs = await findSkillDirs(searchPath)

    for (const skillDir of allSkillDirs) {
      const skill = await parseSkillMd(join(skillDir, 'SKILL.md'))
      if (skill && !seenNames.has(skill.name)) {
        skills.push(skill)
        seenNames.add(skill.name)
      }
    }
  }

  return skills
}

/**
 * Get display name for a skill
 */
export function getSkillDisplayName(skill: Skill): string {
  return skill.name || basename(skill.path)
}

/**
 * Filter skills based on user input (case-insensitive)
 */
export function filterSkills(skills: Skill[], inputNames: string[]): Skill[] {
  const normalizedInputs = inputNames.map(n => n.toLowerCase())

  return skills.filter(skill => {
    const name = skill.name.toLowerCase()
    const displayName = getSkillDisplayName(skill).toLowerCase()

    return normalizedInputs.some(input => input === name || input === displayName)
  })
}
