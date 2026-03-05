import simpleGit from "simple-git"
import { join, normalize, resolve, sep } from "path"
import { mkdtemp, rm } from "fs/promises"
import { tmpdir } from "os"
import { CLONE_TIMEOUT_MS, GIT_TERMINAL_PROMPT } from "./constants"

export class GitCloneError extends Error {
  readonly url: string
  readonly isTimeout: boolean
  readonly isAuthError: boolean
  readonly isNetworkError: boolean

  constructor(message: string, url: string, isTimeout = false, isAuthError = false, isNetworkError = false) {
    super(message)
    this.name = "GitCloneError"
    this.url = url
    this.isTimeout = isTimeout
    this.isAuthError = isAuthError
    this.isNetworkError = isNetworkError
  }
}

/**
 * Detect if error is a network connectivity issue
 */
function isNetworkError(errorMessage: string): boolean {
  const networkErrorPatterns = [
    'Failed to connect',
    'Could not connect to server',
    'Connection timed out',
    'Connection refused',
    'unable to access',
    'Could not resolve host',
    'Network is unreachable',
    'Operation timed out'
  ]
  return networkErrorPatterns.some(pattern => errorMessage.includes(pattern))
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function cloneRepo(url: string, ref?: string, maxRetries = 3): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "skills-"))
  process.env.GIT_TERMINAL_PROMPT = GIT_TERMINAL_PROMPT
  
  // Check for proxy configuration
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy
  
  const gitConfig: any = {
    timeout: { block: CLONE_TIMEOUT_MS },
  }
  
  // Configure proxy if available
  if (httpProxy || httpsProxy) {
    gitConfig.config = [
      `http.proxy=${httpProxy || httpsProxy}`,
      `https.proxy=${httpsProxy || httpProxy}`
    ]
  }
  
  const cloneOptions = ref ? ["--depth", "1", "--branch", ref] : ["--depth", "1"]
  
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const git = simpleGit(gitConfig)
      await git.clone(url, tempDir, cloneOptions)
      return tempDir
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errorMessage = lastError.message
      
      const isTimeout = errorMessage.includes("block timeout") || errorMessage.includes("timed out")
      const isAuthError =
        errorMessage.includes("Authentication failed") ||
        errorMessage.includes("could not read Username") ||
        errorMessage.includes("Permission denied") ||
        errorMessage.includes("Repository not found")
      const isNetwork = isNetworkError(errorMessage)
      
      // Don't retry auth errors
      if (isAuthError) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {})
        throw new GitCloneError(
          `Authentication failed for ${url}.\n` +
            `  - For private repos, ensure you have access\n` +
            `  - For SSH: Check your keys with 'ssh -T git@github.com'\n` +
            `  - For HTTPS: Run 'gh auth login' or configure git credentials`,
          url,
          false,
          true,
          false
        )
      }
      
      // Retry network errors and timeouts
      if ((isNetwork || isTimeout) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // Exponential backoff: 1s, 2s, 4s
        await sleep(delay)
        continue
      }
      
      // Last attempt failed
      if (attempt === maxRetries) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {})
        
        if (isNetwork) {
          throw new GitCloneError(
            `Network error: Failed to connect to ${url} after ${maxRetries} attempts.\n` +
              `  Possible solutions:\n` +
              `  - Check your internet connection\n` +
              `  - Configure a proxy: set HTTP_PROXY=http://your-proxy:port\n` +
              `  - Try using SSH instead of HTTPS (or vice versa)\n` +
              `  - Check if GitHub is accessible: ping github.com\n` +
              `  - Disable VPN/firewall temporarily if applicable`,
            url,
            false,
            false,
            true
          )
        }
        
        if (isTimeout) {
          throw new GitCloneError(
            `Clone timed out after ${maxRetries} attempts.\n` +
              `  Possible solutions:\n` +
              `  - Check your network speed and stability\n` +
              `  - Configure a proxy if behind a firewall\n` +
              `  - Try again later when network is more stable`,
            url,
            true,
            false,
            false
          )
        }
        
        throw new GitCloneError(
          `Failed to clone ${url} after ${maxRetries} attempts: ${errorMessage}`,
          url,
          false,
          false,
          false
        )
      }
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Unknown error during clone')
}

export async function cleanupTempDir(dir: string): Promise<void> {
  // Validate that the directory path is within tmpdir to prevent deletion of arbitrary paths
  const normalizedDir = normalize(resolve(dir))
  const normalizedTmpDir = normalize(resolve(tmpdir()))

  if (!normalizedDir.startsWith(normalizedTmpDir + sep) && normalizedDir !== normalizedTmpDir) {
    throw new Error("Attempted to clean up directory outside of temp directory")
  }

  await rm(dir, { recursive: true, force: true })
}
