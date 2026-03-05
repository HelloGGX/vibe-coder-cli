import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  sanitizeName,
  installSkill,
  isSkillInstalled,
  removeSkill,
  listInstalledSkills,
  getInstallPath,
  getOpencodeSkillsDir,
} from './installer'
import type { Skill } from '../types'

describe('skill installer', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `vibe-installer-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('sanitizeName', () => {
    it('should convert to lowercase', () => {
      expect(sanitizeName('MySkill')).toBe('myskill')
    })

    it('should replace special characters with dashes', () => {
      expect(sanitizeName('my@skill#name')).toBe('my-skill-name')
    })

    it('should remove leading and trailing dots and dashes', () => {
      expect(sanitizeName('...my-skill...')).toBe('my-skill')
    })

    it('should handle spaces', () => {
      expect(sanitizeName('my skill name')).toBe('my-skill-name')
    })

    it('should truncate long names', () => {
      const longName = 'a'.repeat(300)
      const sanitized = sanitizeName(longName)
      expect(sanitized.length).toBeLessThanOrEqual(255)
    })

    it('should return unnamed-skill for empty input', () => {
      expect(sanitizeName('')).toBe('unnamed-skill')
      expect(sanitizeName('...')).toBe('unnamed-skill')
    })

    it('should prevent path traversal', () => {
      expect(sanitizeName('../../../etc/passwd')).toBe('etc-passwd')
      expect(sanitizeName('..\\..\\windows\\system32')).toBe('windows-system32')
    })
  })

  describe('getOpencodeSkillsDir', () => {
    it('should return correct path', () => {
      const skillsDir = getOpencodeSkillsDir(testDir)
      expect(skillsDir).toBe(join(testDir, '.opencode', 'skills'))
    })

    it('should use process.cwd() when no cwd provided', () => {
      const skillsDir = getOpencodeSkillsDir()
      expect(skillsDir).toContain('.opencode')
      expect(skillsDir).toContain('skills')
    })
  })

  describe('installSkill', () => {
    it('should install a skill successfully', async () => {
      // Create source skill
      const sourceDir = join(testDir, 'source')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Test Skill', 'utf-8')
      writeFileSync(join(sourceDir, 'helper.ts'), 'export const helper = true', 'utf-8')

      const skill: Skill = {
        name: 'test-skill',
        description: 'A test skill',
        path: sourceDir,
        rawContent: '# Test Skill',
      }

      const result = await installSkill(skill, { cwd: testDir })

      expect(result.success).toBe(true)
      expect(result.path).toBe(join(testDir, '.opencode', 'skills', 'test-skill'))
      expect(existsSync(join(result.path, 'SKILL.md'))).toBe(true)
      expect(existsSync(join(result.path, 'helper.ts'))).toBe(true)
    })

    it('should exclude .git directory', async () => {
      const sourceDir = join(testDir, 'source')
      const gitDir = join(sourceDir, '.git')
      mkdirSync(gitDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Test', 'utf-8')
      writeFileSync(join(gitDir, 'config'), 'git config', 'utf-8')

      const skill: Skill = {
        name: 'test-skill',
        description: 'Test',
        path: sourceDir,
        rawContent: '# Test',
      }

      const result = await installSkill(skill, { cwd: testDir })

      expect(result.success).toBe(true)
      expect(existsSync(join(result.path, '.git'))).toBe(false)
    })

    it('should exclude files starting with underscore', async () => {
      const sourceDir = join(testDir, 'source')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Test', 'utf-8')
      writeFileSync(join(sourceDir, '_internal.ts'), 'internal', 'utf-8')

      const skill: Skill = {
        name: 'test-skill',
        description: 'Test',
        path: sourceDir,
        rawContent: '# Test',
      }

      const result = await installSkill(skill, { cwd: testDir })

      expect(result.success).toBe(true)
      expect(existsSync(join(result.path, '_internal.ts'))).toBe(false)
    })

    it('should exclude metadata.json', async () => {
      const sourceDir = join(testDir, 'source')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Test', 'utf-8')
      writeFileSync(join(sourceDir, 'metadata.json'), '{}', 'utf-8')

      const skill: Skill = {
        name: 'test-skill',
        description: 'Test',
        path: sourceDir,
        rawContent: '# Test',
      }

      const result = await installSkill(skill, { cwd: testDir })

      expect(result.success).toBe(true)
      expect(existsSync(join(result.path, 'metadata.json'))).toBe(false)
    })

    it('should sanitize skill name', async () => {
      const sourceDir = join(testDir, 'source')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Test', 'utf-8')

      const skill: Skill = {
        name: 'My@Skill#Name',
        description: 'Test',
        path: sourceDir,
        rawContent: '# Test',
      }

      const result = await installSkill(skill, { cwd: testDir })

      expect(result.success).toBe(true)
      expect(result.path).toContain('my-skill-name')
    })

    it('should prevent path traversal attacks', async () => {
      const sourceDir = join(testDir, 'source')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Test', 'utf-8')

      const skill: Skill = {
        name: '../../../etc/passwd',
        description: 'Test',
        path: sourceDir,
        rawContent: '# Test',
      }

      const result = await installSkill(skill, { cwd: testDir })

      expect(result.success).toBe(true)
      // Should be sanitized and installed in correct location
      expect(result.path).toContain('.opencode')
      // The sanitized name will be 'etc-passwd', so it will contain 'etc'
      // but it should be in the safe location
      expect(result.path).toContain('skills')
      expect(result.path.split('skills')[1]).toContain('etc-passwd')
    })

    it('should overwrite existing skill', async () => {
      const sourceDir = join(testDir, 'source')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Version 1', 'utf-8')

      const skill: Skill = {
        name: 'test-skill',
        description: 'Test',
        path: sourceDir,
        rawContent: '# Version 1',
      }

      // Install first version
      await installSkill(skill, { cwd: testDir })

      // Update source
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Version 2', 'utf-8')

      // Install second version
      const result = await installSkill(skill, { cwd: testDir })

      expect(result.success).toBe(true)
      const content = readFileSync(join(result.path, 'SKILL.md'), 'utf-8')
      expect(content).toBe('# Version 2')
    })
  })

  describe('isSkillInstalled', () => {
    it('should return false for non-existent skill', async () => {
      const installed = await isSkillInstalled('non-existent', { cwd: testDir })
      expect(installed).toBe(false)
    })

    it('should return true for installed skill', async () => {
      const sourceDir = join(testDir, 'source')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Test', 'utf-8')

      const skill: Skill = {
        name: 'test-skill',
        description: 'Test',
        path: sourceDir,
        rawContent: '# Test',
      }

      await installSkill(skill, { cwd: testDir })

      const installed = await isSkillInstalled('test-skill', { cwd: testDir })
      expect(installed).toBe(true)
    })

    it('should sanitize skill name before checking', async () => {
      const sourceDir = join(testDir, 'source')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Test', 'utf-8')

      const skill: Skill = {
        name: 'test-skill',
        description: 'Test',
        path: sourceDir,
        rawContent: '# Test',
      }

      await installSkill(skill, { cwd: testDir })

      // Check with unsanitized name
      const installed = await isSkillInstalled('Test@Skill', { cwd: testDir })
      expect(installed).toBe(true)
    })
  })

  describe('removeSkill', () => {
    it('should remove installed skill', async () => {
      const sourceDir = join(testDir, 'source')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'SKILL.md'), '# Test', 'utf-8')

      const skill: Skill = {
        name: 'test-skill',
        description: 'Test',
        path: sourceDir,
        rawContent: '# Test',
      }

      const installResult = await installSkill(skill, { cwd: testDir })
      expect(existsSync(installResult.path)).toBe(true)

      const removed = await removeSkill('test-skill', { cwd: testDir })
      expect(removed).toBe(true)
      expect(existsSync(installResult.path)).toBe(false)
    })

    it('should return true even if skill does not exist', async () => {
      const removed = await removeSkill('non-existent', { cwd: testDir })
      expect(removed).toBe(true)
    })
  })

  describe('listInstalledSkills', () => {
    it('should return empty array when no skills installed', async () => {
      const skills = await listInstalledSkills({ cwd: testDir })
      expect(skills).toEqual([])
    })

    it('should list installed skills', async () => {
      // Install multiple skills
      for (let i = 1; i <= 3; i++) {
        const sourceDir = join(testDir, `source${i}`)
        mkdirSync(sourceDir, { recursive: true })
        writeFileSync(join(sourceDir, 'SKILL.md'), `# Skill ${i}`, 'utf-8')

        const skill: Skill = {
          name: `skill-${i}`,
          description: `Skill ${i}`,
          path: sourceDir,
          rawContent: `# Skill ${i}`,
        }

        await installSkill(skill, { cwd: testDir })
      }

      const skills = await listInstalledSkills({ cwd: testDir })
      expect(skills).toHaveLength(3)
      expect(skills).toContain('skill-1')
      expect(skills).toContain('skill-2')
      expect(skills).toContain('skill-3')
    })

    it('should only return directories', async () => {
      const skillsDir = getOpencodeSkillsDir(testDir)
      mkdirSync(skillsDir, { recursive: true })

      // Create a skill directory
      mkdirSync(join(skillsDir, 'real-skill'))

      // Create a file (should be ignored)
      writeFileSync(join(skillsDir, 'not-a-skill.txt'), 'test', 'utf-8')

      const skills = await listInstalledSkills({ cwd: testDir })
      expect(skills).toEqual(['real-skill'])
    })
  })

  describe('getInstallPath', () => {
    it('should return correct install path', () => {
      const path = getInstallPath('test-skill', { cwd: testDir })
      expect(path).toBe(join(testDir, '.opencode', 'skills', 'test-skill'))
    })

    it('should sanitize skill name', () => {
      const path = getInstallPath('Test@Skill', { cwd: testDir })
      expect(path).toContain('test-skill')
    })

    it('should prevent path traversal in install path', () => {
      const path = getInstallPath('../../../etc/passwd', { cwd: testDir })
      // Should be sanitized to 'etc-passwd' and placed in safe location
      expect(path).toContain('.opencode')
      expect(path).toContain('skills')
      expect(path).toContain('etc-passwd')
      // Should NOT escape the skills directory
      expect(path.split('skills')[0]).toContain('.opencode')
    })
  })
})
