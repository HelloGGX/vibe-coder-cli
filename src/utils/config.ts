import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs"
import path from "path"
import { parse as parseJsonc } from "jsonc-parser"
import { OPENCODE_DIR, LOCK_FILE, CONFIG_FILE, YELLOW, RESET, RULES_SUBDIR } from "../constants"
import type { VibeLock, OpencodeConfig } from "../types"
import { ErrorSeverity, handleExecError } from "./error"

/**
 * Get the path to the vibe lock file
 * @param cwd - Optional working directory, defaults to process.cwd()
 * @returns Absolute path to vibe-lock.json
 */
export function getLockFilePath(cwd?: string) {
  return path.join(cwd || process.cwd(), OPENCODE_DIR, LOCK_FILE)
}

/**
 * Read and parse the vibe lock file
 * @param cwd - Optional working directory, defaults to process.cwd()
 * @returns Parsed lock file data, or empty lock file if not found
 */
export function readLockFile(cwd?: string): VibeLock {
  const lockPath = getLockFilePath(cwd)
  try {
    if (existsSync(lockPath)) {
      const parsed = JSON.parse(readFileSync(lockPath, "utf-8"))
      
      // Ensure all required fields exist
      if (typeof parsed.version !== 'number') {
        return createEmptyLockFile()
      }
      
      if (!parsed.skills) parsed.skills = {}
      if (!parsed.tools) parsed.tools = {}
      if (!parsed.rules) parsed.rules = {}
      if (!parsed.agents) parsed.agents = {}
      
      return parsed
    }
  } catch (e) {}
  return createEmptyLockFile()
}

/**
 * Write lock file data to disk with sorted entries
 * @param lockData - Lock file data to write
 * @param cwd - Optional working directory, defaults to process.cwd()
 */
export function writeLockFile(lockData: VibeLock, cwd?: string) {
  const lockPath = getLockFilePath(cwd)
  const dir = path.dirname(lockPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  
  // Sort all entries alphabetically for deterministic output / clean diffs
  const sorted: VibeLock = {
    version: lockData.version,
    skills: sortObject(lockData.skills),
    tools: sortObject(lockData.tools),
    rules: sortObject(lockData.rules),
    agents: sortObject(lockData.agents)
  }
  
  // Add trailing newline for better git diffs
  const content = JSON.stringify(sorted, null, 2) + '\n'
  writeFileSync(lockPath, content, "utf-8")
}

/**
 * Update lock file with a transaction-like pattern
 * Reads current state, applies updater function, and writes back atomically
 * 
 * @param updater - Function that modifies the lock data
 * @param cwd - Optional working directory, defaults to process.cwd()
 * 
 * @example
 * ```ts
 * updateLockFile((lock) => {
 *   lock.tools['new-tool'] = { source: 'owner/repo', sourceType: 'github' }
 * })
 * ```
 */
export function updateLockFile(updater: (lock: VibeLock) => void, cwd?: string): void {
  const lockData = readLockFile(cwd)
  updater(lockData)
  writeLockFile(lockData, cwd)
}

/**
 * Batch update lock file entries in a single transaction
 * Supports adding, updating, and removing skills, tools, and rules
 * 
 * @param updates - Object containing updates to apply
 * @param cwd - Optional working directory, defaults to process.cwd()
 * 
 * @example
 * ```ts
 * batchUpdateLockFile({
 *   skills: { 'new-skill': { source: 'owner/repo', sourceType: 'github' } },
 *   removeTools: ['old-tool']
 * })
 * ```
 */
export interface LockFileUpdate {
  skills?: Record<string, VibeLock['skills'][string]>
  tools?: Record<string, VibeLock['tools'][string]>
  rules?: Record<string, VibeLock['rules'][string]>
  agents?: Record<string, VibeLock['agents'][string]>
  removeSkills?: string[]
  removeTools?: string[]
  removeRules?: string[]
  removeAgents?: string[]
}

export function batchUpdateLockFile(updates: LockFileUpdate, cwd?: string): void {
  updateLockFile((lock) => {
    // Add or update entries
    if (updates.skills) {
      Object.assign(lock.skills, updates.skills)
    }
    if (updates.tools) {
      Object.assign(lock.tools, updates.tools)
    }
    if (updates.rules) {
      Object.assign(lock.rules, updates.rules)
    }
    if (updates.agents) {
      Object.assign(lock.agents, updates.agents)
    }
    
    // Remove entries
    if (updates.removeSkills) {
      updates.removeSkills.forEach(name => delete lock.skills[name])
    }
    if (updates.removeTools) {
      updates.removeTools.forEach(name => delete lock.tools[name])
    }
    if (updates.removeRules) {
      updates.removeRules.forEach(name => delete lock.rules[name])
    }
    if (updates.removeAgents) {
      updates.removeAgents.forEach(name => delete lock.agents[name])
    }
  }, cwd)
}

function sortObject<T>(obj: Record<string, T>): Record<string, T> {
  const sorted: Record<string, T> = {}
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key]!
  }
  return sorted
}

function createEmptyLockFile(): VibeLock {
  return {
    version: 1,
    skills: {},
    tools: {},
    rules: {},
    agents: {}
  }
}

/**
 * Ensure OpenCode configuration directory and file exist
 * Creates default config if not present, does not overwrite existing config
 * 
 * @param cwd - Optional working directory, defaults to process.cwd()
 */
export function ensureOpencodeConfig(cwd?: string) {
  const configPath = path.join(cwd || process.cwd(), OPENCODE_DIR, CONFIG_FILE)
  const configDir = path.dirname(configPath)
  
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true })
  
  if (!existsSync(configPath)) {
    const jsoncContent = `{
  "$schema": "https://opencode.ai/config.json",
  "theme": "one-dark",
  "instructions": [],
  "mcp": {
    "shadcnVue": { "type": "local", "enabled": true, "command": ["npx", "shadcn-vue@latest", "mcp"] },
    "context7": { "type": "remote", "url": "https://mcp.context7.com/mcp" }
  },
  "tools": {},
  "permission": { "edit": "ask", "skill": { "*": "allow" } }
}`
    writeFileSync(configPath, jsoncContent, "utf-8")
  }
}

/**
 * Update opencode.jsonc configuration with new tools and rule paths
 * Parses JSONC (with comments), adds entries, and writes back
 * 
 * @param newTools - Array of tool names to add
 * @param newRulePaths - Array of rule file paths to add to instructions
 * @param cwd - Optional working directory, defaults to process.cwd()
 */
export function updateOpencodeConfig(newTools: string[], newRulePaths: string[], cwd?: string) {
  if (newTools.length === 0 && newRulePaths.length === 0) return;
  
  const configPath = path.join(cwd || process.cwd(), OPENCODE_DIR, CONFIG_FILE)
  if (!existsSync(configPath)) return;

  try {
    const content = readFileSync(configPath, "utf-8")
    const config = parseJsonc(content) as OpencodeConfig
    let updated = false

    if (newTools.length > 0) {
      config.tools = config.tools || {}
      for (const tool of newTools) {
        if (!config.tools[tool]) {
          config.tools[tool] = true
          updated = true
        }
      }
    }

    if (newRulePaths.length > 0) {
      config.instructions = config.instructions || []
      for (const rulePath of newRulePaths) {
        if (!config.instructions.includes(rulePath)) {
          config.instructions.push(rulePath)
          updated = true
        }
      }
    }

    if (updated) writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8")
  } catch (e) {
    handleExecError(e, "Failed to update opencode.jsonc", ErrorSeverity.WARN)
  }
}

/**
 * Remove tools and rules from opencode.jsonc configuration
 * Parses JSONC, removes specified entries, and writes back
 * 
 * @param toolsToRemove - Array of tool names to remove
 * @param rulesToRemove - Array of rule categories to remove from instructions
 * @param cwd - Optional working directory, defaults to process.cwd()
 */
export function removeOpencodeConfig(toolsToRemove: string[], rulesToRemove: string[], cwd?: string) {
  if (toolsToRemove.length === 0 && rulesToRemove.length === 0) return;

  const configPath = path.join(cwd || process.cwd(), OPENCODE_DIR, CONFIG_FILE)
  if (!existsSync(configPath)) return;

  try {
    const content = readFileSync(configPath, "utf-8")
    const config = parseJsonc(content) as OpencodeConfig
    let updated = false

    // 1. 从 tools 字典中删除对应的 key
    if (toolsToRemove.length > 0 && config.tools) {
      for (const tool of toolsToRemove) {
        if (tool in config.tools) {
          delete config.tools[tool]
          updated = true
        }
      }
    }

    // 2. 从 instructions 数组中过滤掉包含被删规则类别的路径
    if (rulesToRemove.length > 0 && config.instructions) {
      const originalLength = config.instructions.length
      config.instructions = config.instructions.filter(inst => {
        // 匹配规则路径，例如: "./rules/typescript/coding-style.md"
        // 只要包含了 "/rules/被删类别/" 就将其过滤掉
        return !rulesToRemove.some(rule => inst.includes(`/${RULES_SUBDIR}/${rule}/`))
      })
      if (config.instructions.length !== originalLength) {
        updated = true
      }
    }

    if (updated) writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8")
  } catch (e) {
    handleExecError(e, "Failed to remove items from opencode.jsonc", ErrorSeverity.WARN)
  }
}