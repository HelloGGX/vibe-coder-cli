import { execSync } from 'child_process'
import { join } from 'path'

const CLI_PATH = join(__dirname, 'cli.ts')

/**
 * Strip ANSI color codes from string
 */
export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

/**
 * Strip logo from CLI output
 */
export function stripLogo(str: string): string {
  return str
    .split('\n')
    .filter((line) => !line.includes('██') && !line.includes('╔') && !line.includes('╚'))
    .join('\n')
    .replace(/^\n+/, '')
}

/**
 * Check if output contains logo
 */
export function hasLogo(str: string): boolean {
  return str.includes('██') || str.includes('╔') || str.includes('╚')
}

/**
 * Run CLI command and capture output
 */
export function runCli(
  args: string[],
  cwd?: string,
  env?: Record<string, string>,
  timeout?: number
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const output = execSync(`bun run "${CLI_PATH}" ${args.join(' ')}`, {
      encoding: 'utf-8',
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : undefined,
      timeout: timeout ?? 30000,
    })
    return { stdout: stripAnsi(output), stderr: '', exitCode: 0 }
  } catch (error: any) {
    return {
      stdout: stripAnsi(error.stdout || ''),
      stderr: stripAnsi(error.stderr || ''),
      exitCode: error.status || 1,
    }
  }
}

/**
 * Run CLI and return combined output
 */
export function runCliOutput(args: string[], cwd?: string): string {
  const result = runCli(args, cwd)
  return result.stdout || result.stderr
}

/**
 * Run CLI with stdin input
 */
export function runCliWithInput(
  args: string[],
  input: string,
  cwd?: string
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const output = execSync(`bun run "${CLI_PATH}" ${args.join(' ')}`, {
      encoding: 'utf-8',
      cwd,
      input: input + '\n',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { stdout: stripAnsi(output), stderr: '', exitCode: 0 }
  } catch (error: any) {
    return {
      stdout: stripAnsi(error.stdout || ''),
      stderr: stripAnsi(error.stderr || ''),
      exitCode: error.status || 1,
    }
  }
}

/**
 * Create a test skill directory with SKILL.md
 */
export function createTestSkill(
  baseDir: string,
  skillName: string,
  description: string = 'Test skill'
): string {
  const { mkdirSync, writeFileSync } = require('fs')
  const { join } = require('path')
  
  const skillDir = join(baseDir, skillName)
  mkdirSync(skillDir, { recursive: true })
  
  const skillContent = `---
name: ${skillName}
description: ${description}
---

# ${skillName}

This is a test skill for testing purposes.
`
  
  writeFileSync(join(skillDir, 'SKILL.md'), skillContent, 'utf-8')
  return skillDir
}

/**
 * Create a test tool file
 */
export function createTestTool(
  baseDir: string,
  toolName: string,
  hasPython: boolean = false
): void {
  const { mkdirSync, writeFileSync } = require('fs')
  const { join } = require('path')
  
  const toolDir = join(baseDir, 'tool')
  mkdirSync(toolDir, { recursive: true })
  
  // Create TypeScript tool
  const tsContent = `export function ${toolName}() {
  console.log('${toolName} executed')
}
`
  writeFileSync(join(toolDir, `${toolName}.ts`), tsContent, 'utf-8')
  
  // Create Python tool if requested
  if (hasPython) {
    const pyContent = `def ${toolName}():
    print('${toolName} executed')
`
    writeFileSync(join(toolDir, `${toolName}.py`), pyContent, 'utf-8')
  }
}

/**
 * Create a test rule file
 */
export function createTestRule(
  baseDir: string,
  category: string,
  ruleName: string,
  content: string = '# Test Rule\n\nThis is a test rule.'
): void {
  const { mkdirSync, writeFileSync } = require('fs')
  const { join } = require('path')
  
  const ruleDir = join(baseDir, 'rules', category)
  mkdirSync(ruleDir, { recursive: true })
  
  writeFileSync(join(ruleDir, `${ruleName}.md`), content, 'utf-8')
}
