import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { copyToolFiles, installRules, removeToolFiles, removeRuleCategory } from './file'

describe('file utilities', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `vibe-file-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('copyToolFiles', () => {
    it('should copy TypeScript tool file', () => {
      const sourceDir = join(testDir, 'source')
      const targetDir = join(testDir, 'target')
      mkdirSync(sourceDir, { recursive: true })
      mkdirSync(targetDir, { recursive: true })

      writeFileSync(join(sourceDir, 'my-tool.ts'), 'export const tool = true', 'utf-8')

      const hasPython = copyToolFiles('my-tool', sourceDir, targetDir)

      expect(hasPython).toBe(false)
      expect(existsSync(join(targetDir, 'my-tool.ts'))).toBe(true)
      expect(readFileSync(join(targetDir, 'my-tool.ts'), 'utf-8')).toBe('export const tool = true')
    })

    it('should copy both TypeScript and Python files', () => {
      const sourceDir = join(testDir, 'source')
      const targetDir = join(testDir, 'target')
      mkdirSync(sourceDir, { recursive: true })
      mkdirSync(targetDir, { recursive: true })

      writeFileSync(join(sourceDir, 'my-tool.ts'), 'export const tool = true', 'utf-8')
      writeFileSync(join(sourceDir, 'my-tool.py'), 'def tool(): pass', 'utf-8')

      const hasPython = copyToolFiles('my-tool', sourceDir, targetDir)

      expect(hasPython).toBe(true)
      expect(existsSync(join(targetDir, 'my-tool.ts'))).toBe(true)
      expect(existsSync(join(targetDir, 'my-tool.py'))).toBe(true)
    })

    it('should return false when only TypeScript file exists', () => {
      const sourceDir = join(testDir, 'source')
      const targetDir = join(testDir, 'target')
      mkdirSync(sourceDir, { recursive: true })
      mkdirSync(targetDir, { recursive: true })

      writeFileSync(join(sourceDir, 'tool.ts'), 'content', 'utf-8')

      const hasPython = copyToolFiles('tool', sourceDir, targetDir)

      expect(hasPython).toBe(false)
    })

    it('should handle missing source files gracefully', () => {
      const sourceDir = join(testDir, 'source')
      const targetDir = join(testDir, 'target')
      mkdirSync(sourceDir, { recursive: true })
      mkdirSync(targetDir, { recursive: true })

      // No files created, should not throw
      const hasPython = copyToolFiles('nonexistent', sourceDir, targetDir)

      expect(hasPython).toBe(false)
      expect(existsSync(join(targetDir, 'nonexistent.ts'))).toBe(false)
    })
  })

  describe('installRules', () => {
    it('should install common rules', () => {
      const sourceDir = join(testDir, 'source', 'rules')
      const targetDir = join(testDir, 'target', 'rules')
      
      const commonDir = join(sourceDir, 'common')
      mkdirSync(commonDir, { recursive: true })
      writeFileSync(join(commonDir, 'style.md'), '# Style Guide', 'utf-8')
      writeFileSync(join(commonDir, 'security.md'), '# Security', 'utf-8')

      const paths = installRules([], sourceDir, targetDir)

      expect(paths).toContain('./rules/common/style.md')
      expect(paths).toContain('./rules/common/security.md')
      expect(existsSync(join(targetDir, 'common', 'style.md'))).toBe(true)
      expect(existsSync(join(targetDir, 'common', 'security.md'))).toBe(true)
    })

    it('should install specific category rules', () => {
      const sourceDir = join(testDir, 'source', 'rules')
      const targetDir = join(testDir, 'target', 'rules')
      
      const commonDir = join(sourceDir, 'common')
      const tsDir = join(sourceDir, 'typescript')
      mkdirSync(commonDir, { recursive: true })
      mkdirSync(tsDir, { recursive: true })
      
      writeFileSync(join(commonDir, 'base.md'), '# Base', 'utf-8')
      writeFileSync(join(tsDir, 'ts-style.md'), '# TS Style', 'utf-8')

      const paths = installRules(['typescript'], sourceDir, targetDir)

      expect(paths).toContain('./rules/common/base.md')
      expect(paths).toContain('./rules/typescript/ts-style.md')
      expect(existsSync(join(targetDir, 'typescript', 'ts-style.md'))).toBe(true)
    })

    it('should install multiple categories', () => {
      const sourceDir = join(testDir, 'source', 'rules')
      const targetDir = join(testDir, 'target', 'rules')
      
      const commonDir = join(sourceDir, 'common')
      const tsDir = join(sourceDir, 'typescript')
      const javaDir = join(sourceDir, 'java')
      
      mkdirSync(commonDir, { recursive: true })
      mkdirSync(tsDir, { recursive: true })
      mkdirSync(javaDir, { recursive: true })
      
      writeFileSync(join(commonDir, 'common.md'), '# Common', 'utf-8')
      writeFileSync(join(tsDir, 'ts.md'), '# TS', 'utf-8')
      writeFileSync(join(javaDir, 'java.md'), '# Java', 'utf-8')

      const paths = installRules(['typescript', 'java'], sourceDir, targetDir)

      expect(paths).toHaveLength(3) // common + typescript + java
      expect(paths).toContain('./rules/typescript/ts.md')
      expect(paths).toContain('./rules/java/java.md')
    })

    it('should only copy .md files', () => {
      const sourceDir = join(testDir, 'source', 'rules')
      const targetDir = join(testDir, 'target', 'rules')
      
      const commonDir = join(sourceDir, 'common')
      mkdirSync(commonDir, { recursive: true })
      
      writeFileSync(join(commonDir, 'rule.md'), '# Rule', 'utf-8')
      writeFileSync(join(commonDir, 'config.json'), '{}', 'utf-8')
      writeFileSync(join(commonDir, 'script.ts'), 'code', 'utf-8')

      const paths = installRules([], sourceDir, targetDir)

      expect(paths).toHaveLength(1)
      expect(paths).toContain('./rules/common/rule.md')
      expect(existsSync(join(targetDir, 'common', 'rule.md'))).toBe(true)
      expect(existsSync(join(targetDir, 'common', 'config.json'))).toBe(false)
      expect(existsSync(join(targetDir, 'common', 'script.ts'))).toBe(false)
    })

    it('should handle missing source directories', () => {
      const sourceDir = join(testDir, 'source', 'rules')
      const targetDir = join(testDir, 'target', 'rules')

      // No source directories created
      const paths = installRules(['nonexistent'], sourceDir, targetDir)

      expect(paths).toEqual([])
    })

    it('should create target directory if not exists', () => {
      const sourceDir = join(testDir, 'source', 'rules')
      const targetDir = join(testDir, 'target', 'rules')
      
      const commonDir = join(sourceDir, 'common')
      mkdirSync(commonDir, { recursive: true })
      writeFileSync(join(commonDir, 'rule.md'), '# Rule', 'utf-8')

      expect(existsSync(targetDir)).toBe(false)

      installRules([], sourceDir, targetDir)

      expect(existsSync(targetDir)).toBe(true)
    })
  })

  describe('removeToolFiles', () => {
    it('should remove TypeScript tool file', () => {
      const targetDir = join(testDir, 'target')
      mkdirSync(targetDir, { recursive: true })
      
      writeFileSync(join(targetDir, 'tool.ts'), 'content', 'utf-8')

      expect(existsSync(join(targetDir, 'tool.ts'))).toBe(true)

      removeToolFiles('tool', targetDir)

      expect(existsSync(join(targetDir, 'tool.ts'))).toBe(false)
    })

    it('should remove both TypeScript and Python files', () => {
      const targetDir = join(testDir, 'target')
      mkdirSync(targetDir, { recursive: true })
      
      writeFileSync(join(targetDir, 'tool.ts'), 'ts content', 'utf-8')
      writeFileSync(join(targetDir, 'tool.py'), 'py content', 'utf-8')

      removeToolFiles('tool', targetDir)

      expect(existsSync(join(targetDir, 'tool.ts'))).toBe(false)
      expect(existsSync(join(targetDir, 'tool.py'))).toBe(false)
    })

    it('should handle non-existent files gracefully', () => {
      const targetDir = join(testDir, 'target')
      mkdirSync(targetDir, { recursive: true })

      // Should not throw
      expect(() => removeToolFiles('nonexistent', targetDir)).not.toThrow()
    })

    it('should only remove specified tool files', () => {
      const targetDir = join(testDir, 'target')
      mkdirSync(targetDir, { recursive: true })
      
      writeFileSync(join(targetDir, 'tool1.ts'), 'content1', 'utf-8')
      writeFileSync(join(targetDir, 'tool2.ts'), 'content2', 'utf-8')

      removeToolFiles('tool1', targetDir)

      expect(existsSync(join(targetDir, 'tool1.ts'))).toBe(false)
      expect(existsSync(join(targetDir, 'tool2.ts'))).toBe(true)
    })
  })

  describe('removeRuleCategory', () => {
    it('should remove rule category directory', () => {
      const targetDir = join(testDir, 'target', 'rules')
      const categoryDir = join(targetDir, 'typescript')
      
      mkdirSync(categoryDir, { recursive: true })
      writeFileSync(join(categoryDir, 'rule1.md'), '# Rule 1', 'utf-8')
      writeFileSync(join(categoryDir, 'rule2.md'), '# Rule 2', 'utf-8')

      expect(existsSync(categoryDir)).toBe(true)

      removeRuleCategory('typescript', targetDir)

      expect(existsSync(categoryDir)).toBe(false)
    })

    it('should handle non-existent category gracefully', () => {
      const targetDir = join(testDir, 'target', 'rules')
      mkdirSync(targetDir, { recursive: true })

      // Should not throw
      expect(() => removeRuleCategory('nonexistent', targetDir)).not.toThrow()
    })

    it('should only remove specified category', () => {
      const targetDir = join(testDir, 'target', 'rules')
      const tsDir = join(targetDir, 'typescript')
      const javaDir = join(targetDir, 'java')
      
      mkdirSync(tsDir, { recursive: true })
      mkdirSync(javaDir, { recursive: true })
      
      writeFileSync(join(tsDir, 'ts.md'), '# TS', 'utf-8')
      writeFileSync(join(javaDir, 'java.md'), '# Java', 'utf-8')

      removeRuleCategory('typescript', targetDir)

      expect(existsSync(tsDir)).toBe(false)
      expect(existsSync(javaDir)).toBe(true)
    })

    it('should remove nested files and directories', () => {
      const targetDir = join(testDir, 'target', 'rules')
      const categoryDir = join(targetDir, 'typescript')
      const nestedDir = join(categoryDir, 'advanced')
      
      mkdirSync(nestedDir, { recursive: true })
      writeFileSync(join(categoryDir, 'basic.md'), '# Basic', 'utf-8')
      writeFileSync(join(nestedDir, 'advanced.md'), '# Advanced', 'utf-8')

      removeRuleCategory('typescript', targetDir)

      expect(existsSync(categoryDir)).toBe(false)
      expect(existsSync(nestedDir)).toBe(false)
    })
  })
})
