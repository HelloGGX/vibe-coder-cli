import { execSync } from "child_process"
import { existsSync, writeFileSync, readFileSync } from "fs"
import path from "path"
import * as p from "@clack/prompts"
import { ErrorSeverity, handleExecError } from "./error"

export function setupPythonEnvironment(rootDir: string, spinner: ReturnType<typeof p.spinner>) {
  spinner.message(`Initializing Python environment in ./.venv ...`)
  try {
    const reqPath = path.join(rootDir, "requirements.txt")
    const reqContent = `# 核心依赖\nrequests>=2.28.0\nurllib3>=1.26.0\npython-dotenv>=0.19.0\n`

    if (!existsSync(reqPath)) {
      writeFileSync(reqPath, reqContent, "utf-8")
    } else {
      const existingReq = readFileSync(reqPath, "utf-8")
      if (!existingReq.includes("requests>=")) writeFileSync(reqPath, existingReq + "\n" + reqContent, "utf-8")
    }

    const venvPath = path.join(rootDir, ".venv")
    if (!existsSync(venvPath)) {
      try {
        execSync(`python3 -m venv "${venvPath}"`, { stdio: "ignore" })
      } catch {
        execSync(`python -m venv "${venvPath}"`, { stdio: "ignore" })
      }
    }

    const pipCmd =
      process.platform === "win32" ? path.join(venvPath, "Scripts", "pip") : path.join(venvPath, "bin", "pip")
    spinner.message(`Installing Python dependencies...`)
    execSync(`"${pipCmd}" install -r "${reqPath}"`, { stdio: "ignore" })
  } catch (pyError) {
    spinner.stop()
    handleExecError(pyError, "Failed to initialize Python environment. Manual setup required.", ErrorSeverity.WARN)
  }
}

export function getPythonActivationCmd(): string {
  const isWin = process.platform === "win32"
  if (isWin) {
    return `# Windows CMD 
venv\\Scripts\\activate.bat

# Windows PowerShell
.\\.venv\\Scripts\\Activate.ps1`
  }
  return "source .venv/bin/activate"
}
