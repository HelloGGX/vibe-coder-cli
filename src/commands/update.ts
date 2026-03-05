import * as p from "@clack/prompts"
import { existsSync } from "fs"
import path from "path"
import { cloneRepo, cleanupTempDir } from "../git"
import { readLockFile, writeLockFile } from "../utils/config"
import { copyToolFiles, installRules } from "../utils/file"
import { handleExecError, ErrorSeverity } from "../utils/error"
import { computeFolderHash, computeFilesHash } from "../utils/hash"
import { OPENCODE_DIR, TOOL_SUBDIR, RULES_SUBDIR, RESET, CYAN, DIM, TEXT, BOLD, GREEN } from "../constants"
import {
  getSkillsBySource,
  installSkill,
  parseSkillMd,
  getOpencodeSkillsDir,
  sanitizeName
} from "../skills"

export async function runUpdate(args: string[]) {
  console.log(`\n${BOLD}📦  Updating Skills, Tools & Rules...${RESET}\n`)

  const lockData = readLockFile()
  const skillsBySource = await getSkillsBySource()
  const toolNames = Object.keys(lockData.tools || {})
  const ruleNames = Object.keys(lockData.rules || {})

  if (skillsBySource.size === 0 && toolNames.length === 0 && ruleNames.length === 0) {
    return console.log(`  ${DIM}No items to update.${RESET}\n`)
  }

  // Group tools and rules by source
  const itemsBySource: Record<string, { tools: string[], rules: string[], skills: string[] }> = {}

  // Add skills grouped by source
  for (const [source, data] of skillsBySource) {
    itemsBySource[source] = { tools: [], rules: [], skills: data.skills }
  }

  // Add tools grouped by source
  toolNames.forEach(t => {
    const s = lockData.tools[t]?.source
    if (s) {
      if (!itemsBySource[s]) itemsBySource[s] = { tools: [], rules: [], skills: [] }
      itemsBySource[s].tools.push(t)
    }
  })

  // Add rules grouped by source
  ruleNames.forEach(r => {
    const s = lockData.rules![r]?.source
    if (s) {
      if (!itemsBySource[s]) itemsBySource[s] = { tools: [], rules: [], skills: [] }
      itemsBySource[s].rules.push(r)
    }
  })

  const targetToolDir = path.join(process.cwd(), OPENCODE_DIR, TOOL_SUBDIR)
  const targetRulesDir = path.join(process.cwd(), OPENCODE_DIR, RULES_SUBDIR)
  const skillsDir = getOpencodeSkillsDir()

  const sourcesCount = Object.keys(itemsBySource).length

  const s = p.spinner()
  s.start(`Fetching from ${CYAN}${sourcesCount}${RESET} source(s) concurrently...`)

  // Build parallel update tasks
  const updatePromises = Object.entries(itemsBySource).map(
    async ([source, items]) => {
      let tempDir: string | null = null
      let successCount = 0
      const logs: string[] = []

      try {
        tempDir = await cloneRepo(source)

        // Update Skills
        if (items.skills.length > 0) {
          for (const skillName of items.skills) {
            const sanitized = sanitizeName(skillName)
            const skillDir = path.join(skillsDir, sanitized)

            // Try to find the skill in the cloned repo
            const skillMdPath = path.join(tempDir, 'SKILL.md')
            if (existsSync(skillMdPath)) {
              const skill = await parseSkillMd(skillMdPath)
              if (skill) {
                const result = await installSkill(skill)
                if (result.success && result.path) {
                  // Update hash in lock file
                  const computedHash = await computeFolderHash(result.path)
                  if (lockData.skills[skillName]) {
                    lockData.skills[skillName].computedHash = computedHash
                  }
                  
                  successCount++
                  logs.push(`  ${GREEN}✓${RESET} Updated skill: ${skillName}`)
                }
              }
            }
          }
        }

        // Update Tools
        if (items.tools.length > 0 && existsSync(path.join(tempDir, "tool"))) {
          for (const tool of items.tools) {
            copyToolFiles(tool, path.join(tempDir, "tool"), targetToolDir)
            
            // Update hash in lock file
            const toolFiles = [
              path.join(targetToolDir, `${tool}.ts`),
              path.join(targetToolDir, `${tool}.py`)
            ]
            const computedHash = await computeFilesHash(toolFiles)
            if (lockData.tools[tool]) {
              lockData.tools[tool].computedHash = computedHash
            }
            
            successCount++
            logs.push(`  ${GREEN}✓${RESET} Updated tool: ${tool}`)
          }
        }

        // Update Rules
        if (items.rules.length > 0 && existsSync(path.join(tempDir, "rules"))) {
          installRules(items.rules, path.join(tempDir, "rules"), targetRulesDir)
          for (const rule of items.rules) {
            // Update hash in lock file
            const ruleDir = path.join(targetRulesDir, rule)
            const computedHash = await computeFolderHash(ruleDir)
            if (lockData.rules[rule]) {
              lockData.rules[rule].computedHash = computedHash
            }
            
            successCount++
            logs.push(`  ${GREEN}✓${RESET} Updated rule: ${rule}`)
          }
        }

        return { source, success: true, count: successCount, logs }
      } catch (err) {
        return { source, success: false, count: 0, error: err, logs: [] }
      } finally {
        if (tempDir) await cleanupTempDir(tempDir).catch(() => {})
      }
    }
  )

  // Wait for all sources to complete
  const results = await Promise.allSettled(updatePromises)
  s.stop(`Finished fetching from ${sourcesCount} source(s).`)

  // Process results and print logs
  let totalSuccessCount = 0

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { source, success, count, logs, error } = result.value
      if (success) {
        totalSuccessCount += count
        logs.forEach(log => console.log(log))
      } else {
        handleExecError(error, `Failed to fetch from ${source}`, ErrorSeverity.WARN)
      }
    } else {
      handleExecError(result.reason, "Unexpected error during concurrent update", ErrorSeverity.ERROR)
    }
  }

  // Write lock file once at the end
  writeLockFile(lockData)

  if (totalSuccessCount > 0) {
    console.log(`${TEXT}✓ Successfully updated ${totalSuccessCount} item(s)${RESET}\n`)
  }
}
