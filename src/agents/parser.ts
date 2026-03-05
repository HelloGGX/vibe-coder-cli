import { readFile, readdir, stat } from 'fs/promises'
import { join, basename } from 'path'
import type { Agent } from '../types'

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): { metadata: any; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { metadata: {}, body: content }
  }

  const [, frontmatter = '', body = ''] = match
  const metadata: any = {}

  frontmatter.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) return

    const key = line.slice(0, colonIndex).trim()
    const value = line.slice(colonIndex + 1).trim()

    // Parse arrays
    if (value.startsWith('[') && value.endsWith(']')) {
      metadata[key] = value
        .slice(1, -1)
        .split(',')
        .map(v => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else {
      metadata[key] = value.replace(/^["']|["']$/g, '')
    }
  })

  return { metadata, body }
}

/**
 * Parse a single agent markdown file
 */
export async function parseAgentMd(filePath: string): Promise<Agent | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const { metadata, body } = parseFrontmatter(content)

    const name = metadata.name || basename(filePath, '.md')
    const description = metadata.description || ''

    return {
      name,
      description,
      path: filePath,
      rawContent: content,
      metadata
    }
  } catch {
    return null
  }
}

/**
 * Discover all agents in a directory
 */
export async function discoverAgents(
  baseDir: string,
  subpath?: string
): Promise<Agent[]> {
  const searchDir = subpath ? join(baseDir, subpath) : baseDir
  const agents: Agent[] = []

  try {
    const entries = await readdir(searchDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(searchDir, entry.name)

      if (entry.isFile() && entry.name.endsWith('.md')) {
        const agent = await parseAgentMd(fullPath)
        if (agent) {
          agents.push(agent)
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_')) {
        // Recursively search subdirectories
        const subAgents = await discoverAgents(fullPath)
        agents.push(...subAgents)
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return agents
}

/**
 * Get display name for an agent
 */
export function getAgentDisplayName(agent: Agent): string {
  return agent.name
}

/**
 * Filter agents by name pattern
 */
export function filterAgents(agents: Agent[], pattern?: string): Agent[] {
  if (!pattern) return agents

  const regex = new RegExp(pattern, 'i')
  return agents.filter(agent => 
    regex.test(agent.name) || regex.test(agent.description)
  )
}
