import { readLockFile } from "../utils/config"
import { OPENCODE_DIR, TOOL_SUBDIR, RULES_SUBDIR, RESET, BOLD, CYAN, DIM } from "../constants"
import { listInstalledSkills, getAllLockedSkills } from "../skills"

export async function runList(args: string[]) {
  const lockData = readLockFile()

  console.log(`\n${BOLD}🪄  Installed Skills (${OPENCODE_DIR}/skills):${RESET}\n`)
  const installedSkills = await listInstalledSkills()
  const lockedSkills = await getAllLockedSkills()

  if (installedSkills.length === 0) {
    console.log(`  ${DIM}No skills installed yet.${RESET}`)
  } else {
    installedSkills.forEach((skillName) => {
      const lockEntry = lockedSkills[skillName]
      const source = lockEntry?.source || "unknown"
      console.log(`  ${CYAN}◆${RESET} ${skillName} ${DIM}(${source})${RESET}`)
    })
  }

  console.log(`\n${BOLD}🛠️  Installed Tools (${OPENCODE_DIR}/${TOOL_SUBDIR}):${RESET}\n`)
  const tools = Object.keys(lockData.tools || {})
  if (tools.length === 0) {
    console.log(`  ${DIM}No tools installed yet.${RESET}`)
  } else {
    tools.forEach((t) =>
      console.log(`  ${CYAN}◆${RESET} ${t} ${DIM}(${lockData.tools[t]?.source || "unknown"})${RESET}`),
    )
  }

  console.log(`\n${BOLD}📜  Installed Rules (${OPENCODE_DIR}/${RULES_SUBDIR}):${RESET}\n`)
  const rules = Object.keys(lockData.rules || {})
  if (rules.length === 0) {
    console.log(`  ${DIM}No rules installed yet.${RESET}`)
  } else {
    rules.forEach((r) =>
      console.log(`  ${CYAN}◆${RESET} ${r} ${DIM}(${lockData.rules![r]?.source || "unknown"})${RESET}`),
    )
  }

  console.log()
}
