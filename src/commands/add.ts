import * as p from "@clack/prompts"
import { existsSync, mkdirSync, readdirSync } from "fs"
import path from "path"
import { cloneRepo, cleanupTempDir, GitCloneError } from "../git"
import { readLockFile, writeLockFile, ensureOpencodeConfig, updateOpencodeConfig } from "../utils/config"
import { copyToolFiles, installRules } from "../utils/file"
import { setupPythonEnvironment, getPythonActivationCmd } from "../utils/python"
import { ErrorSeverity, handleExecError } from "../utils/error"
import { ensureBunInstalled, ensurePythonInstalled } from "../utils/env"
import { computeFolderHash, computeFilesHash } from "../utils/hash"
import { OPENCODE_DIR, TOOL_SUBDIR, RULES_SUBDIR, RESET, CYAN, BG_CYAN, GREEN } from "../constants"
import {
  discoverSkills,
  installSkill,
  parseSource,
  getOwnerRepo,
  getSkillDisplayName
} from "../skills"
import {
  discoverAgents,
  installAgent,
  getAgentDisplayName
} from "../agents"

export async function runAdd(args: string[]) {
  const repository = args[0]
  if (!repository) {
    handleExecError(new Error("Repository name is missing"), "Argument Error", ErrorSeverity.ERROR)
    return
  }

  p.intro(`${BG_CYAN} vibe cli ${RESET}`)

  // Parse source to get proper URL
  const parsed = parseSource(repository)
  const repoUrl = parsed.url
  const ownerRepo = getOwnerRepo(parsed)

  p.note(`Repository: ${CYAN}${repoUrl}${RESET}\nTarget: ${CYAN}${OPENCODE_DIR}${RESET}`, "Initializing")

  const s = p.spinner()
  s.start("Fetching remote repository...")
  let tempDir: string | null = null

  try {
    // 1. Clone repository (with retry mechanism)
    tempDir = await cloneRepo(repoUrl, parsed.ref)
    s.stop("Remote repository fetched successfully.")

    // 2. Discover skills in the repository
    const skills = await discoverSkills(tempDir, parsed.subpath)

    const toolDirPath = path.join(tempDir, "tool")
    const rulesDirPath = path.join(tempDir, "rules")
    const agentsDirPath = path.join(tempDir, "agents")
    const hasTools = existsSync(toolDirPath)
    const hasRules = existsSync(rulesDirPath)
    const hasSkills = skills.length > 0
    const hasAgents = existsSync(agentsDirPath)

    if (!hasTools && !hasRules && !hasSkills && !hasAgents) {
      return handleExecError(
        new Error("No skills, tools, rules, or agents found in repository."),
        "Parse Error",
        ErrorSeverity.WARN,
      )
    }

    let selectedSkills: typeof skills = []
    let selectedTools: string[] = []
    let selectedRules: string[] = []
    let selectedAgents: Awaited<ReturnType<typeof discoverAgents>> = []

    // 3. UI interaction: Select Skills
    if (hasSkills) {
      const res = await p.multiselect({
        message: "Select skills to install (space to toggle)",
        options: skills.map(sk => ({
          value: sk,
          label: getSkillDisplayName(sk),
          hint: sk.description
        })),
        required: false,
      })
      if (p.isCancel(res)) return p.cancel("Installation cancelled.")
      if (Array.isArray(res)) selectedSkills = res as typeof skills
    }

    // 4. UI interaction: Select Tools
    if (hasTools) {
      const opts = readdirSync(toolDirPath)
        .filter((f) => f.endsWith(".ts"))
        .map((f) => f.replace(/\.ts$/, ""))
      if (opts.length > 0) {
        const res = await p.multiselect({
          message: "Select tools to install (space to toggle)",
          options: opts.map((t) => ({ value: t, label: t })),
          required: false,
        })
        if (p.isCancel(res)) return p.cancel("Installation cancelled.")
        if (Array.isArray(res)) selectedTools = res as string[]
      }
    }

    // 5. UI interaction: Select Rules
    if (hasRules) {
      const opts = readdirSync(rulesDirPath, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== "common")
        .map((d) => d.name)
      if (opts.length > 0) {
        const res = await p.multiselect({
          message: "Select rule categories to install",
          options: opts.map((r) => ({ value: r, label: r })),
          required: false,
        })
        if (p.isCancel(res)) return p.cancel("Installation cancelled.")
        if (Array.isArray(res)) selectedRules = res as string[]
      }
    }

    // 6. UI interaction: Select Agents
    if (hasAgents) {
      const agents = await discoverAgents(agentsDirPath)
      if (agents.length > 0) {
        const res = await p.multiselect({
          message: "Select agents to install (space to toggle)",
          options: agents.map(agent => ({
            value: agent,
            label: getAgentDisplayName(agent),
            hint: agent.description
          })),
          required: false,
        })
        if (p.isCancel(res)) return p.cancel("Installation cancelled.")
        if (Array.isArray(res)) selectedAgents = res as typeof agents
      }
    }

    if (selectedSkills.length === 0 && selectedTools.length === 0 && selectedRules.length === 0 && selectedAgents.length === 0) {
      return p.cancel("No skills, tools, rules, or agents selected.")
    }

    // 7. Environment checks
    let requiresPython = false

    if (selectedTools.length > 0) {
      p.log.step("Checking system environments...")

      const bunReady = await ensureBunInstalled()
      if (!bunReady) {
        selectedTools = []
        p.log.warn("Skipping tool installation (Bun not available).")
      } else {
        for (const tool of selectedTools) {
          if (existsSync(path.join(toolDirPath, `${tool}.py`))) {
            requiresPython = true
            break
          }
        }
        if (requiresPython) {
          ensurePythonInstalled()
        }
      }
    }

    // 8. Install skills, tools, rules, and agents
    const installSpinner = p.spinner()
    installSpinner.start(`Installing to ${OPENCODE_DIR}/ ...`)

    ensureOpencodeConfig()
    let installedRulePaths: string[] = []

    // 读取现有的 lock 文件
    const lockData = readLockFile()

    // Install Skills
    if (selectedSkills.length > 0) {
      for (const skill of selectedSkills) {
        const result = await installSkill(skill)
        if (result.success && result.path) {
          // Compute hash of installed skill directory
          const computedHash = await computeFolderHash(result.path)
          
          lockData.skills[skill.name] = {
            source: ownerRepo || repoUrl,
            sourceType: parsed.type,
            skillPath: parsed.subpath,
            computedHash
          }
        }
      }
    }

    // Install Tools
    if (selectedTools.length > 0) {
      const targetToolDir = path.join(process.cwd(), OPENCODE_DIR, TOOL_SUBDIR)
      if (!existsSync(targetToolDir)) mkdirSync(targetToolDir, { recursive: true })

      for (const tool of selectedTools) {
        copyToolFiles(tool, toolDirPath, targetToolDir)
        
        // Compute hash of installed tool files (.ts and .py)
        const toolFiles = [
          path.join(targetToolDir, `${tool}.ts`),
          path.join(targetToolDir, `${tool}.py`)
        ]
        const computedHash = await computeFilesHash(toolFiles)
        
        lockData.tools[tool] = { 
          source: repoUrl,
          sourceType: parsed.type,
          computedHash
        }
      }
    }

    // Install Rules
    if (selectedRules.length > 0) {
      const targetRulesDir = path.join(process.cwd(), OPENCODE_DIR, RULES_SUBDIR)
      installedRulePaths = installRules(selectedRules, rulesDirPath, targetRulesDir)

      for (const rule of selectedRules) {
        // Compute hash of installed rule directory
        const ruleDir = path.join(targetRulesDir, rule)
        const computedHash = await computeFolderHash(ruleDir)
        
        lockData.rules[rule] = { 
          source: repoUrl,
          sourceType: parsed.type,
          computedHash
        }
      }
    }

    // Install Agents
    if (selectedAgents.length > 0) {
      for (const agent of selectedAgents) {
        const result = await installAgent(agent)
        if (result.success && result.path) {
          // Compute hash of installed agent file
          const computedHash = await computeFilesHash([result.path])
          
          lockData.agents[agent.name] = {
            source: ownerRepo || repoUrl,
            sourceType: parsed.type,
            computedHash
          }
        }
      }
    }

    // 统一写入 lock 文件
    writeLockFile(lockData)

    // Update config
    updateOpencodeConfig(selectedTools, installedRulePaths)

    if (requiresPython) setupPythonEnvironment(process.cwd(), installSpinner)

    await new Promise((r) => setTimeout(r, 400))
    installSpinner.stop(`${GREEN}Successfully installed ${selectedSkills.length + selectedTools.length + selectedRules.length + selectedAgents.length} items.${RESET}`)

    if (requiresPython) {
      p.note(
        `Your Python tools are ready. Run the following command to activate the environment:\n\n  ${CYAN}${getPythonActivationCmd()}${RESET}`,
        "🐍 Python Environment",
      )
    }
  } catch (error) {
    if (s) s.stop("Failed to fetch repository.")
    if (error instanceof GitCloneError) {
      if (error.isNetworkError) {
        p.log.error("Network connection failed. Please check your internet connection or proxy settings.")
        p.note(
          `If you're in China or behind a firewall, try:\n\n` +
          `  1. Set up a proxy:\n` +
          `     ${CYAN}set HTTP_PROXY=http://127.0.0.1:7890${RESET}\n` +
          `     ${CYAN}set HTTPS_PROXY=http://127.0.0.1:7890${RESET}\n\n` +
          `  2. Or use a mirror (if available):\n` +
          `     ${CYAN}git config --global url."https://mirror.ghproxy.com/https://github.com/".insteadOf "https://github.com/"${RESET}\n\n` +
          `  3. Or clone manually and use local path:\n` +
          `     ${CYAN}vibe add ./path/to/local/repo${RESET}`,
          "💡 Network Troubleshooting"
        )
      }
      handleExecError(error, "Git Error", ErrorSeverity.ERROR)
    } else {
      handleExecError(error, "Repository Fetch Error", ErrorSeverity.ERROR)
    }
  } finally {
    if (tempDir) await cleanupTempDir(tempDir).catch(() => {})
  }

  p.outro(`✨ Workspace updated for ${CYAN}${OPENCODE_DIR}${RESET}`)
}
