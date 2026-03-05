import * as p from "@clack/prompts"
import { existsSync } from "fs"
import path from "path"
import { readLockFile } from "../utils/config"
import { computeFolderHash, computeFilesHash } from "../utils/hash"
import { getOpencodeSkillsDir, sanitizeName, listInstalledSkills } from "../skills"
import { OPENCODE_DIR, TOOL_SUBDIR, RULES_SUBDIR, RESET, CYAN, YELLOW, GREEN, DIM, BOLD } from "../constants"

/**
 * Check if installed skills, tools, and rules have been modified locally
 * by comparing their current hash with the hash stored in the lock file.
 */
export async function runCheck(args: string[]) {
  console.log(`\n${BOLD}🔍  Checking for local modifications...${RESET}\n`)

  const lockData = readLockFile()
  const skillsDir = getOpencodeSkillsDir()
  const targetToolDir = path.join(process.cwd(), OPENCODE_DIR, TOOL_SUBDIR)
  const targetRulesDir = path.join(process.cwd(), OPENCODE_DIR, RULES_SUBDIR)

  let modifiedCount = 0
  let upToDateCount = 0
  let missingHashCount = 0

  // Check Skills
  console.log(`${BOLD}Skills:${RESET}`)
  const installedSkills = await listInstalledSkills()
  
  for (const skillName of installedSkills) {
    const lockEntry = lockData.skills[skillName]
    if (!lockEntry) {
      console.log(`  ${YELLOW}?${RESET} ${skillName} ${DIM}(not in lock file)${RESET}`)
      continue
    }

    if (!lockEntry.computedHash) {
      console.log(`  ${YELLOW}?${RESET} ${skillName} ${DIM}(no hash in lock file)${RESET}`)
      missingHashCount++
      continue
    }

    const sanitized = sanitizeName(skillName)
    const skillDir = path.join(skillsDir, sanitized)
    
    if (!existsSync(skillDir)) {
      console.log(`  ${YELLOW}!${RESET} ${skillName} ${DIM}(directory not found)${RESET}`)
      continue
    }

    const currentHash = await computeFolderHash(skillDir)
    if (currentHash === lockEntry.computedHash) {
      console.log(`  ${GREEN}✓${RESET} ${skillName} ${DIM}(up to date)${RESET}`)
      upToDateCount++
    } else {
      console.log(`  ${YELLOW}✗${RESET} ${skillName} ${YELLOW}(modified locally)${RESET}`)
      modifiedCount++
    }
  }

  // Check Tools
  console.log(`\n${BOLD}Tools:${RESET}`)
  const toolNames = Object.keys(lockData.tools)
  
  for (const toolName of toolNames) {
    const lockEntry = lockData.tools[toolName]
    
    if (!lockEntry || !lockEntry.computedHash) {
      console.log(`  ${YELLOW}?${RESET} ${toolName} ${DIM}(no hash in lock file)${RESET}`)
      missingHashCount++
      continue
    }

    const toolFiles = [
      path.join(targetToolDir, `${toolName}.ts`),
      path.join(targetToolDir, `${toolName}.py`)
    ]
    
    // Check if at least one file exists
    const hasFiles = toolFiles.some(f => existsSync(f))
    if (!hasFiles) {
      console.log(`  ${YELLOW}!${RESET} ${toolName} ${DIM}(files not found)${RESET}`)
      continue
    }

    const currentHash = await computeFilesHash(toolFiles)
    if (currentHash === lockEntry.computedHash) {
      console.log(`  ${GREEN}✓${RESET} ${toolName} ${DIM}(up to date)${RESET}`)
      upToDateCount++
    } else {
      console.log(`  ${YELLOW}✗${RESET} ${toolName} ${YELLOW}(modified locally)${RESET}`)
      modifiedCount++
    }
  }

  // Check Rules
  console.log(`\n${BOLD}Rules:${RESET}`)
  const ruleNames = Object.keys(lockData.rules)
  
  for (const ruleName of ruleNames) {
    const lockEntry = lockData.rules[ruleName]
    
    if (!lockEntry || !lockEntry.computedHash) {
      console.log(`  ${YELLOW}?${RESET} ${ruleName} ${DIM}(no hash in lock file)${RESET}`)
      missingHashCount++
      continue
    }

    const ruleDir = path.join(targetRulesDir, ruleName)
    
    if (!existsSync(ruleDir)) {
      console.log(`  ${YELLOW}!${RESET} ${ruleName} ${DIM}(directory not found)${RESET}`)
      continue
    }

    const currentHash = await computeFolderHash(ruleDir)
    if (currentHash === lockEntry.computedHash) {
      console.log(`  ${GREEN}✓${RESET} ${ruleName} ${DIM}(up to date)${RESET}`)
      upToDateCount++
    } else {
      console.log(`  ${YELLOW}✗${RESET} ${ruleName} ${YELLOW}(modified locally)${RESET}`)
      modifiedCount++
    }
  }

  // Summary
  console.log(`\n${BOLD}Summary:${RESET}`)
  console.log(`  ${GREEN}${upToDateCount}${RESET} up to date`)
  if (modifiedCount > 0) {
    console.log(`  ${YELLOW}${modifiedCount}${RESET} modified locally`)
  }
  if (missingHashCount > 0) {
    console.log(`  ${YELLOW}${missingHashCount}${RESET} missing hash (run 'vibe update' to fix)`)
  }
  console.log()

  if (modifiedCount > 0) {
    console.log(`${DIM}Tip: Modified items may have been edited manually. Run 'vibe update' to restore them.${RESET}\n`)
  }
}
