/**
 * Represents a single entry in the vibe lock file.
 * 
 * Intentionally minimal and timestamp-free to minimize merge conflicts.
 * Two branches adding different items produce non-overlapping JSON keys
 * that git can auto-merge cleanly.
 */
export interface VibeLockEntry {
  /** Where the item came from: owner/repo, URL, etc. */
  source: string
  /** The source type (e.g., "github", "gitlab", "git", "local") */
  sourceType: string
  /**
   * SHA-256 hash computed from all files in the item's folder.
   * Used to detect content changes and avoid unnecessary reinstalls.
   * For skills: hash of skill directory
   * For tools: hash of tool files (.ts and .py)
   * For rules: hash of rule directory
   */
  computedHash?: string
}

/**
 * The structure of the vibe lock file.
 * This file is meant to be checked into version control.
 * 
 * Items are sorted alphabetically by name when written to produce
 * deterministic output and minimize merge conflicts.
 */
export interface VibeLock {
  /** Schema version for future migrations */
  version: number
  /** Map of skill name to its lock entry */
  skills: Record<string, VibeLockEntry & { skillPath?: string }>
  /** Map of tool name to its lock entry */
  tools: Record<string, VibeLockEntry>
  /** Map of rule name to its lock entry */
  rules: Record<string, VibeLockEntry>
  /** Map of agent name to its lock entry */
  agents: Record<string, VibeLockEntry>
}

export interface SkillLockEntry {
  source: string
  sourceType: string
  sourceUrl: string
  skillPath?: string
}

export interface Skill {
  name: string
  description: string
  path: string
  rawContent: string
  metadata?: any
}

export interface Agent {
  name: string
  description: string
  path: string
  rawContent: string
  metadata?: any
}

export interface OpencodeConfig {
  $schema?: string
  theme?: string
  instructions?: string[]
  mcp?: Record<string, any>
  tools?: Record<string, boolean>
  permission?: Record<string, any>
}