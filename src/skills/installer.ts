import { mkdir, cp, access, rm, readdir } from 'fs/promises'
import { join, basename, normalize, resolve, sep } from 'path'
import type { Skill } from '../types'
import { OPENCODE_DIR } from '../constants'

/**
 * Sanitizes a filename/directory name to prevent path traversal attacks
 */
export function sanitizeName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')

  return sanitized.substring(0, 255) || 'unnamed-skill'
}

/**
 * Validates that a path is within an expected base directory
 */
function isPathSafe(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalize(resolve(basePath))
  const normalizedTarget = normalize(resolve(targetPath))

  return normalizedTarget.startsWith(normalizedBase + sep) || normalizedTarget === normalizedBase
}

/**
 * Get the OpenCode skills directory
 */
export function getOpencodeSkillsDir(cwd?: string): string {
  const baseDir = cwd || process.cwd()
  return join(baseDir, OPENCODE_DIR, 'skills')
}

/**
 * Cleans and recreates a directory for skill installation
 */
async function cleanAndCreateDirectory(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
  await mkdir(path, { recursive: true })
}

const EXCLUDE_FILES = new Set(['metadata.json'])
const EXCLUDE_DIRS = new Set(['.git'])

const isExcluded = (name: string, isDirectory: boolean = false): boolean => {
  if (EXCLUDE_FILES.has(name)) return true
  if (name.startsWith('_')) return true
  if (isDirectory && EXCLUDE_DIRS.has(name)) return true
  return false
}

/**
 * Copy a directory recursively
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })

  const entries = await readdir(src, { withFileTypes: true })

  await Promise.all(
    entries
      .filter(entry => !isExcluded(entry.name, entry.isDirectory()))
      .map(async entry => {
        const srcPath = join(src, entry.name)
        const destPath = join(dest, entry.name)

        if (entry.isDirectory()) {
          await copyDirectory(srcPath, destPath)
        } else {
          await cp(srcPath, destPath, {
            dereference: true,
            recursive: true
          })
        }
      })
  )
}

export interface InstallResult {
  success: boolean
  path: string
  error?: string
}

/**
 * Install a skill to OpenCode
 */
export async function installSkill(
  skill: Skill,
  options: { cwd?: string } = {}
): Promise<InstallResult> {
  const cwd = options.cwd || process.cwd()

  // Sanitize skill name
  const rawSkillName = skill.name || basename(skill.path)
  const skillName = sanitizeName(rawSkillName)

  // Target location: .opencode/skills/<skill-name>
  const skillsBase = getOpencodeSkillsDir(cwd)
  const skillDir = join(skillsBase, skillName)

  // Validate paths
  if (!isPathSafe(skillsBase, skillDir)) {
    return {
      success: false,
      path: skillDir,
      error: 'Invalid skill name: potential path traversal detected'
    }
  }

  try {
    await cleanAndCreateDirectory(skillDir)
    await copyDirectory(skill.path, skillDir)

    return {
      success: true,
      path: skillDir
    }
  } catch (error) {
    return {
      success: false,
      path: skillDir,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check if a skill is installed
 */
export async function isSkillInstalled(
  skillName: string,
  options: { cwd?: string } = {}
): Promise<boolean> {
  const sanitized = sanitizeName(skillName)
  const skillsBase = getOpencodeSkillsDir(options.cwd)
  const skillDir = join(skillsBase, sanitized)

  if (!isPathSafe(skillsBase, skillDir)) {
    return false
  }

  try {
    await access(skillDir)
    return true
  } catch {
    return false
  }
}

/**
 * Get the install path for a skill
 */
export function getInstallPath(
  skillName: string,
  options: { cwd?: string } = {}
): string {
  const sanitized = sanitizeName(skillName)
  const skillsBase = getOpencodeSkillsDir(options.cwd)
  const installPath = join(skillsBase, sanitized)

  if (!isPathSafe(skillsBase, installPath)) {
    throw new Error('Invalid skill name: potential path traversal detected')
  }

  return installPath
}

/**
 * Remove a skill from OpenCode
 */
export async function removeSkill(
  skillName: string,
  options: { cwd?: string } = {}
): Promise<boolean> {
  try {
    const skillPath = getInstallPath(skillName, options)
    await rm(skillPath, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

/**
 * List all installed skills
 */
export async function listInstalledSkills(
  options: { cwd?: string } = {}
): Promise<string[]> {
  const skillsBase = getOpencodeSkillsDir(options.cwd)

  try {
    const entries = await readdir(skillsBase, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
  } catch {
    return []
  }
}
