import { readdir, readFile, stat } from "fs/promises"
import { join, relative } from "path"
import { createHash } from "crypto"

/**
 * Compute a SHA-256 hash from all files in a directory.
 * Reads all files recursively, sorts them by relative path for determinism,
 * and produces a single hash from their concatenated contents.
 * 
 * This is used to detect content changes in skills, tools, and rules.
 */
export async function computeFolderHash(dir: string): Promise<string> {
  const files: Array<{ relativePath: string; content: Buffer }> = []
  await collectFiles(dir, dir, files)

  // Sort by relative path for deterministic hashing
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  const hash = createHash("sha256")
  for (const file of files) {
    // Include the path in the hash so renames are detected
    hash.update(file.relativePath)
    hash.update(file.content)
  }

  return hash.digest("hex")
}

/**
 * Compute a SHA-256 hash from specific files (for tools that have both .ts and .py versions).
 */
export async function computeFilesHash(filePaths: string[]): Promise<string> {
  const files: Array<{ relativePath: string; content: Buffer }> = []
  
  for (const filePath of filePaths) {
    try {
      const content = await readFile(filePath)
      files.push({ relativePath: filePath, content })
    } catch {
      // File doesn't exist, skip it
    }
  }

  // Sort by relative path for deterministic hashing
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  const hash = createHash("sha256")
  for (const file of files) {
    hash.update(file.relativePath)
    hash.update(file.content)
  }

  return hash.digest("hex")
}

async function collectFiles(
  baseDir: string,
  currentDir: string,
  results: Array<{ relativePath: string; content: Buffer }>
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true })

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(currentDir, entry.name)

      if (entry.isDirectory()) {
        // Skip .git and node_modules
        if (entry.name === ".git" || entry.name === "node_modules") return
        await collectFiles(baseDir, fullPath, results)
      } else if (entry.isFile()) {
        const content = await readFile(fullPath)
        const relativePath = relative(baseDir, fullPath).split("\\").join("/")
        results.push({ relativePath, content })
      }
    })
  )
}
