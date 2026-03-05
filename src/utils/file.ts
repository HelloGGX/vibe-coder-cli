import { existsSync, mkdirSync, cpSync, readdirSync, rmSync } from "fs"
import path from "path"
import { RULES_SUBDIR } from "../constants"

export function copyToolFiles(toolName: string, sourceDir: string, targetDir: string): boolean {
  let hasPython = false;
  const tsFile = `${toolName}.ts`; const pyFile = `${toolName}.py`

  const srcTs = path.join(sourceDir, tsFile)
  if (existsSync(srcTs)) cpSync(srcTs, path.join(targetDir, tsFile), { recursive: true })

  const srcPy = path.join(sourceDir, pyFile)
  if (existsSync(srcPy)) {
    cpSync(srcPy, path.join(targetDir, pyFile), { recursive: true })
    hasPython = true;
  }
  return hasPython;
}

export function installRules(categories: string[], rulesSourceDir: string, targetRulesDir: string): string[] {
  if (!existsSync(targetRulesDir)) mkdirSync(targetRulesDir, { recursive: true })
  
  const installedRulePaths: string[] = []

  const copyDir = (srcFolder: string, targetFolder: string, relativePathPrefix: string) => {
    if (existsSync(srcFolder)) {
      if (!existsSync(targetFolder)) mkdirSync(targetFolder, { recursive: true })
      const files = readdirSync(srcFolder).filter(f => f.endsWith('.md'))
      for (const file of files) {
        cpSync(path.join(srcFolder, file), path.join(targetFolder, file))
        installedRulePaths.push(`./${RULES_SUBDIR}/${relativePathPrefix}/${file}`)
      }
    }
  }

  // 1. 拷贝 common 目录
  copyDir(path.join(rulesSourceDir, "common"), path.join(targetRulesDir, "common"), "common")

  // 2. 拷贝选中的特定类别目录
  for (const category of categories) {
    copyDir(path.join(rulesSourceDir, category), path.join(targetRulesDir, category), category)
  }

  return installedRulePaths
}

// 🌟 新增：删除指定的 Tool 文件
export function removeToolFiles(toolName: string, targetDir: string) {
  const tsFile = path.join(targetDir, `${toolName}.ts`)
  const pyFile = path.join(targetDir, `${toolName}.py`)

  if (existsSync(tsFile)) rmSync(tsFile, { force: true })
  if (existsSync(pyFile)) rmSync(pyFile, { force: true })
}

// 🌟 新增：删除指定的 Rule 目录
export function removeRuleCategory(category: string, targetRulesDir: string) {
  const catDir = path.join(targetRulesDir, category)
  if (existsSync(catDir)) {
    rmSync(catDir, { recursive: true, force: true })
  }
}