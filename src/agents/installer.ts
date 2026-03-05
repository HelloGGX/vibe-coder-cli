import { mkdir, cp, access, rm, readdir } from 'fs/promises'
import { join, basename, normalize, resolve, sep } from 'path'
import type { Agent } from '../types'
import { OPENCODE_DIR, AGENTS_SUBDIR } from '../constants'

/**
 * Sanitizes a filename to prevent path traversal attacks
 */
export function sanitizeAgentName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')

  return sanitized.substring(0, 255) || 'unnamed-agent'
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
 * Get the OpenCode agents directory
 */
export function getOpencodeAgentsDir(cwd?: string): string {
  const baseDir = cwd || process.cwd()
  return join(baseDir, OPENCODE_DIR, AGENTS_SUBDIR)
}

/**
 * Cleans and recreates a directory for agent installation
 */
async function cleanAndCreateDirectory(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
  await mkdir(path, { recursive: true })
}

export interface InstallResult {
  success: boolean
  path: string
  error?: string
}

/**
 * Install an agent to OpenCode
 */
export async function installAgent(
  agent: Agent,
  options: { cwd?: string } = {}
): Promise<InstallResult> {
  const cwd = options.cwd || process.cwd()

  // Sanitize agent name
  const rawAgentName = agent.name || basename(agent.path, '.md')
  const agentName = sanitizeAgentName(rawAgentName)

  // Target location: .opencode/agents/<agent-name>.md
  const agentsBase = getOpencodeAgentsDir(cwd)
  const agentFile = join(agentsBase, `${agentName}.md`)

  // Validate paths
  if (!isPathSafe(agentsBase, agentFile)) {
    return {
      success: false,
      path: agentFile,
      error: 'Invalid agent name: potential path traversal detected'
    }
  }

  try {
    await mkdir(agentsBase, { recursive: true })
    await cp(agent.path, agentFile, { dereference: true })

    return {
      success: true,
      path: agentFile
    }
  } catch (error) {
    return {
      success: false,
      path: agentFile,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check if an agent is installed
 */
export async function isAgentInstalled(
  agentName: string,
  options: { cwd?: string } = {}
): Promise<boolean> {
  const sanitized = sanitizeAgentName(agentName)
  const agentsBase = getOpencodeAgentsDir(options.cwd)
  const agentFile = join(agentsBase, `${sanitized}.md`)

  if (!isPathSafe(agentsBase, agentFile)) {
    return false
  }

  try {
    await access(agentFile)
    return true
  } catch {
    return false
  }
}

/**
 * Get the install path for an agent
 */
export function getInstallPath(
  agentName: string,
  options: { cwd?: string } = {}
): string {
  const sanitized = sanitizeAgentName(agentName)
  const agentsBase = getOpencodeAgentsDir(options.cwd)
  const installPath = join(agentsBase, `${sanitized}.md`)

  if (!isPathSafe(agentsBase, installPath)) {
    throw new Error('Invalid agent name: potential path traversal detected')
  }

  return installPath
}

/**
 * Remove an agent from OpenCode
 */
export async function removeAgent(
  agentName: string,
  options: { cwd?: string } = {}
): Promise<boolean> {
  try {
    const agentPath = getInstallPath(agentName, options)
    await rm(agentPath, { force: true })
    return true
  } catch {
    return false
  }
}

/**
 * List all installed agents
 */
export async function listInstalledAgents(
  options: { cwd?: string } = {}
): Promise<string[]> {
  const agentsBase = getOpencodeAgentsDir(options.cwd)

  try {
    const entries = await readdir(agentsBase, { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
      .map(entry => basename(entry.name, '.md'))
  } catch {
    return []
  }
}
