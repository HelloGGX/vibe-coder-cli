import { execSync } from "child_process"
import * as p from "@clack/prompts"
import { ErrorSeverity, handleExecError } from "./error"
import { CYAN, YELLOW, RESET, BOLD } from "../constants"

/**
 * 检查 Bun 是否安装，未安装时询问用户是否安装
 * 返回 false 表示用户拒绝或安装失败，调用方应跳过 Tool 安装
 */
export async function ensureBunInstalled(): Promise<boolean> {
  try {
    // 尝试获取 bun 版本，验证是否安装
    execSync("bun --version", { stdio: "ignore" })
    return true
  } catch {
    p.log.warn(`${YELLOW}Bun runtime not found. It is required to run TypeScript tools.${RESET}`)

    const install = await p.confirm({
      message: "Install Bun globally via npm?",
    })

    if (p.isCancel(install) || !install) {
      p.log.info(`Skipping Bun installation. You can install it manually: ${CYAN}https://bun.sh${RESET}`)
      return false
    }

    const s = p.spinner()
    s.start("Installing bun globally...")
    try {
      // 自动执行 npm 安装
      execSync("npm install -g bun", { stdio: "ignore" })
      s.stop(`${CYAN}Bun successfully installed!${RESET}`)
      return true
    } catch (error) {
      s.stop("Failed to install Bun.")
      handleExecError(
        new Error("Could not install Bun automatically. Please install it manually: https://bun.sh/"),
        "Environment Error",
        ErrorSeverity.WARN
      )
      return false
    }
  }
}

/**
 * 检查 Python 环境是否存在
 * (仅当需要安装带有 Python 的 Tool 时调用)
 */
export function ensurePythonInstalled(): void {
  let hasPython = false

  try {
    // 优先检查 python3 (macOS/Linux 标准)
    execSync("python3 --version", { stdio: "ignore" })
    hasPython = true
  } catch {
    try {
      // 降级检查 python (Windows 标准)
      execSync("python --version", { stdio: "ignore" })
      hasPython = true
    } catch {}
  }

  if (!hasPython) {
    p.log.error(`
${BOLD}Python is required but not found on your system.${RESET}
The tools you selected contain Python scripts (.py) which require a valid Python environment.

${CYAN}Please install Python:${RESET}
- ${BOLD}Windows${RESET}: Download from https://www.python.org/downloads/
- ${BOLD}macOS${RESET}: Run \`brew install python\`
- ${BOLD}Linux${RESET}: Run \`sudo apt install python3 python3-venv\`
    `)
    // 缺少系统级依赖，直接安全退出
    process.exit(1)
  }
}