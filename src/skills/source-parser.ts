/**
 * Parse a source string into a structured format
 * Supports: GitHub shorthand (owner/repo), GitHub URLs, local paths
 */
export interface ParsedSource {
  type: 'github' | 'local'
  url: string
  ref?: string
  subpath?: string
  localPath?: string
}

/**
 * Check if a string represents a local file system path
 */
function isLocalPath(input: string): boolean {
  return (
    input.startsWith('./') ||
    input.startsWith('../') ||
    input === '.' ||
    input === '..' ||
    /^[a-zA-Z]:[/\\]/.test(input) // Windows absolute paths
  )
}

/**
 * Parse a source string into a structured format
 */
export function parseSource(input: string): ParsedSource {
  // Local path
  if (isLocalPath(input)) {
    return {
      type: 'local',
      url: input,
      localPath: input
    }
  }

  // GitHub URL with path: https://github.com/owner/repo/tree/branch/path/to/skill
  const githubTreeWithPathMatch = input.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/)
  if (githubTreeWithPathMatch) {
    const [, owner, repo, ref, subpath] = githubTreeWithPathMatch
    return {
      type: 'github',
      url: `https://github.com/${owner}/${repo}.git`,
      ref,
      subpath
    }
  }

  // GitHub URL with branch: https://github.com/owner/repo/tree/branch
  const githubTreeMatch = input.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)$/)
  if (githubTreeMatch) {
    const [, owner, repo, ref] = githubTreeMatch
    return {
      type: 'github',
      url: `https://github.com/${owner}/${repo}.git`,
      ref
    }
  }

  // GitHub URL: https://github.com/owner/repo
  const githubRepoMatch = input.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (githubRepoMatch) {
    const [, owner, repo] = githubRepoMatch
    const cleanRepo = repo!.replace(/\.git$/, '')
    return {
      type: 'github',
      url: `https://github.com/${owner}/${cleanRepo}.git`
    }
  }

  // GitHub shorthand: owner/repo or owner/repo/path/to/skill
  const shorthandMatch = input.match(/^([^/]+)\/([^/]+)(?:\/(.+))?$/)
  if (shorthandMatch && !input.includes(':') && !input.startsWith('.') && !input.startsWith('/')) {
    const [, owner, repo, subpath] = shorthandMatch
    return {
      type: 'github',
      url: `https://github.com/${owner}/${repo}.git`,
      subpath
    }
  }

  // Fallback: treat as GitHub URL
  return {
    type: 'github',
    url: input.endsWith('.git') ? input : `${input}.git`
  }
}

/**
 * Extract owner/repo from a parsed source
 */
export function getOwnerRepo(parsed: ParsedSource): string | null {
  if (parsed.type === 'local') {
    return null
  }

  try {
    const url = new URL(parsed.url)
    let path = url.pathname.slice(1)
    path = path.replace(/\.git$/, '')

    if (path.includes('/')) {
      return path
    }
  } catch {
    // Invalid URL
  }

  return null
}
