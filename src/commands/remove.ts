import * as p from "@clack/prompts"
import path from "path"
import { readLockFile, writeLockFile, removeOpencodeConfig } from "../utils/config"
import { removeToolFiles, removeRuleCategory } from "../utils/file"
import { OPENCODE_DIR, TOOL_SUBDIR, RULES_SUBDIR, RESET, CYAN, BG_CYAN, GREEN } from "../constants"
import { ErrorSeverity, handleExecError } from "../utils/error"
import {
  listInstalledSkills,
  removeSkill,
} from "../skills"

export async function runRemove(args: string[]) {
  p.intro(`${BG_CYAN} vibe cli ${RESET}`)

  // Step 1: Scan installed skills, tools, and rules
  const lockData = readLockFile()
  const installedSkills = await listInstalledSkills()
  const installedTools = Object.keys(lockData.tools || {})
  const installedRules = Object.keys(lockData.rules || {})

  if (installedSkills.length === 0 && installedTools.length === 0 && installedRules.length === 0) {
    p.log.info(`No skills, tools, or rules found in ${OPENCODE_DIR}.`)
    return p.outro(`✨ Removal process completed.`)
  }

  let skillsToRemove: string[] = []
  let toolsToRemove: string[] = []
  let rulesToRemove: string[] = []

  // Interactive/Silent routing
  if (args.length > 0) {
    for (const arg of args) {
      if (installedSkills.includes(arg)) skillsToRemove.push(arg)
      else if (installedTools.includes(arg)) toolsToRemove.push(arg)
      else if (installedRules.includes(arg)) rulesToRemove.push(arg)
      else p.log.info(`Item '${arg}' not found, skipping.`)
    }
  } else {
    if (installedSkills.length > 0) {
      const res = await p.multiselect({
        message: "Select skills to remove (space to toggle)",
        options: installedSkills.map(s => ({ value: s, label: s })),
        required: false
      })
      if (p.isCancel(res)) return p.cancel("Operation cancelled.")
      if (Array.isArray(res)) skillsToRemove = res as string[]
    }

    if (installedTools.length > 0) {
      const res = await p.multiselect({
        message: "Select local tools to remove (space to toggle)",
        options: installedTools.map(t => ({ value: t, label: t })),
        required: false
      })
      if (p.isCancel(res)) return p.cancel("Operation cancelled.")
      if (Array.isArray(res)) toolsToRemove = res as string[]
    }

    if (installedRules.length > 0) {
      const res = await p.multiselect({
        message: "Select rule categories to remove (space to toggle)",
        options: installedRules.map(r => ({ value: r, label: r })),
        required: false
      })
      if (p.isCancel(res)) return p.cancel("Operation cancelled.")
      if (Array.isArray(res)) rulesToRemove = res as string[]
    }
  }

  if (skillsToRemove.length === 0 && toolsToRemove.length === 0 && rulesToRemove.length === 0) {
    if (args.length === 0) p.cancel("No items selected for removal.")
    else p.outro(`✨ Removal process completed.`)
    return
  }

  const totalCount = skillsToRemove.length + toolsToRemove.length + rulesToRemove.length
  const confirm = await p.confirm({
    message: `Are you sure you want to remove ${totalCount} item(s)?`
  })

  if (p.isCancel(confirm) || !confirm) {
    return p.cancel("Operation cancelled.")
  }

  // Step 2: Execute removal
  const s = p.spinner()
  s.start(`Cleaning up workspace...`)

  try {
    const targetToolDir = path.join(process.cwd(), OPENCODE_DIR, TOOL_SUBDIR)
    const targetRulesDir = path.join(process.cwd(), OPENCODE_DIR, RULES_SUBDIR)

    // Remove skills
    for (const skill of skillsToRemove) {
      await removeSkill(skill)
      delete lockData.skills[skill]
    }

    // Remove tools
    for (const tool of toolsToRemove) {
      removeToolFiles(tool, targetToolDir)
      delete lockData.tools[tool]
    }

    // Remove rules
    for (const rule of rulesToRemove) {
      removeRuleCategory(rule, targetRulesDir)
      delete lockData.rules[rule]
    }

    // 统一写入 lock 文件
    removeOpencodeConfig(toolsToRemove, rulesToRemove)
    writeLockFile(lockData)

    s.stop(`${GREEN}Successfully removed ${totalCount} item(s).${RESET}`)
  } catch (e) {
    s.stop("Failed to complete removal.")
    handleExecError(e, "Removal Error", ErrorSeverity.ERROR)
  }

  p.outro(`✨ Workspace cleaned for ${CYAN}${OPENCODE_DIR}${RESET}`)
}