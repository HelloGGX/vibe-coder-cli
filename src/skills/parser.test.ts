import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseSkillMd, discoverSkills, getSkillDisplayName, filterSkills } from './parser'
import type { Skill } from '../types'

describe('skill parser', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `vibe-parser-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('parseSkillMd', () => {
    it('should parse valid SKILL.md with frontmatter', async () => {
      const skillDir = join(testDir, 'test-skill')
      mkdirSync(skillDir, { recursive: true })
      
      const content = `---
name: test-skill
description: A test skill for testing
---

# Test Skill

This is the skill content.
`
      writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')

      const skill = await parseSkillMd(join(skillDir, 'SKILL.md'))

      expect(skill).not.toBeNull()
      expect(skill?.name).toBe('test-skill')
      expect(skill?.description).toBe('A test skill for testing')
      expect(skill?.path).toBe(skillDir)
      expect(skill?.rawContent).toBe(content)
    })

    it('should parse skill with metadata', async () => {
      const skillDir = join(testDir, 'skill-with-metadata')
      mkdirSync(skillDir, { recursive: true })
      
      const content = `---
name: metadata-skill
description: Skill with metadata
metadata:
  version: 1.0.0
  author: Test Author
---

# Metadata Skill
`
      writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')

      const skill = await parseSkillMd(join(skillDir, 'SKILL.md'))

      expect(skill).not.toBeNull()
      expect(skill?.metadata).toEqual({
        version: '1.0.0',
        author: 'Test Author'
      })
    })

    it('should return null for missing name', async () => {
      const skillDir = join(testDir, 'no-name')
      mkdirSync(skillDir, { recursive: true })
      
      const content = `---
description: Missing name
---

# Skill
`
      writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')

      const skill = await parseSkillMd(join(skillDir, 'SKILL.md'))

      expect(skill).toBeNull()
    })

    it('should return null for missing description', async () => {
      const skillDir = join(testDir, 'no-desc')
      mkdirSync(skillDir, { recursive: true })
      
      const content = `---
name: no-description
---

# Skill
`
      writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')

      const skill = await parseSkillMd(join(skillDir, 'SKILL.md'))

      expect(skill).toBeNull()
    })

    it('should return null for non-string name', async () => {
      const skillDir = join(testDir, 'invalid-name')
      mkdirSync(skillDir, { recursive: true })
      
      const content = `---
name: 123
description: Invalid name type
---

# Skill
`
      writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')

      const skill = await parseSkillMd(join(skillDir, 'SKILL.md'))

      expect(skill).toBeNull()
    })

    it('should return null for non-existent file', async () => {
      const skill = await parseSkillMd(join(testDir, 'nonexistent', 'SKILL.md'))

      expect(skill).toBeNull()
    })

    it('should return null for invalid YAML frontmatter', async () => {
      const skillDir = join(testDir, 'invalid-yaml')
      mkdirSync(skillDir, { recursive: true })
      
      const content = `---
name: test
description: [invalid yaml structure
---

# Skill
`
      writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')

      const skill = await parseSkillMd(join(skillDir, 'SKILL.md'))

      expect(skill).toBeNull()
    })
  })

  describe('discoverSkills', () => {
    it('should discover skill in root directory', async () => {
      const content = `---
name: root-skill
description: Skill in root
---

# Root Skill
`
      writeFileSync(join(testDir, 'SKILL.md'), content, 'utf-8')

      const skills = await discoverSkills(testDir)

      expect(skills).toHaveLength(1)
      expect(skills[0]?.name).toBe('root-skill')
    })

    it('should discover skills in skills subdirectory', async () => {
      const skillsDir = join(testDir, 'skills')
      const skill1Dir = join(skillsDir, 'skill-1')
      const skill2Dir = join(skillsDir, 'skill-2')
      
      mkdirSync(skill1Dir, { recursive: true })
      mkdirSync(skill2Dir, { recursive: true })

      writeFileSync(join(skill1Dir, 'SKILL.md'), `---
name: skill-1
description: First skill
---
# Skill 1`, 'utf-8')

      writeFileSync(join(skill2Dir, 'SKILL.md'), `---
name: skill-2
description: Second skill
---
# Skill 2`, 'utf-8')

      const skills = await discoverSkills(testDir)

      expect(skills).toHaveLength(2)
      expect(skills.map(s => s.name).sort()).toEqual(['skill-1', 'skill-2'])
    })

    it('should discover skills in .opencode/skills directory', async () => {
      const skillsDir = join(testDir, '.opencode', 'skills', 'opencode-skill')
      mkdirSync(skillsDir, { recursive: true })

      writeFileSync(join(skillsDir, 'SKILL.md'), `---
name: opencode-skill
description: OpenCode skill
---
# OpenCode Skill`, 'utf-8')

      const skills = await discoverSkills(testDir)

      expect(skills).toHaveLength(1)
      expect(skills[0]?.name).toBe('opencode-skill')
    })

    it('should discover skills in .agents/skills directory', async () => {
      const skillsDir = join(testDir, '.agents', 'skills', 'agent-skill')
      mkdirSync(skillsDir, { recursive: true })

      writeFileSync(join(skillsDir, 'SKILL.md'), `---
name: agent-skill
description: Agent skill
---
# Agent Skill`, 'utf-8')

      const skills = await discoverSkills(testDir)

      expect(skills).toHaveLength(1)
      expect(skills[0]?.name).toBe('agent-skill')
    })

    it('should not discover duplicate skills', async () => {
      // Create same skill in multiple locations
      const locations = [
        join(testDir, 'skills', 'duplicate'),
        join(testDir, '.opencode', 'skills', 'duplicate')
      ]

      for (const loc of locations) {
        mkdirSync(loc, { recursive: true })
        writeFileSync(join(loc, 'SKILL.md'), `---
name: duplicate-skill
description: Duplicate skill
---
# Duplicate`, 'utf-8')
      }

      const skills = await discoverSkills(testDir)

      // Should only find one instance
      expect(skills).toHaveLength(1)
      expect(skills[0]?.name).toBe('duplicate-skill')
    })

    it('should skip node_modules directories', async () => {
      const nodeModulesDir = join(testDir, 'node_modules', 'some-package')
      mkdirSync(nodeModulesDir, { recursive: true })

      writeFileSync(join(nodeModulesDir, 'SKILL.md'), `---
name: node-modules-skill
description: Should be skipped
---
# Skip`, 'utf-8')

      const skills = await discoverSkills(testDir)

      expect(skills).toHaveLength(0)
    })

    it('should skip .git directories', async () => {
      const gitDir = join(testDir, '.git', 'hooks')
      mkdirSync(gitDir, { recursive: true })

      writeFileSync(join(gitDir, 'SKILL.md'), `---
name: git-skill
description: Should be skipped
---
# Skip`, 'utf-8')

      const skills = await discoverSkills(testDir)

      expect(skills).toHaveLength(0)
    })

    it('should discover skills with subpath', async () => {
      const subDir = join(testDir, 'subdir', 'nested')
      mkdirSync(subDir, { recursive: true })

      writeFileSync(join(subDir, 'SKILL.md'), `---
name: nested-skill
description: Nested skill
---
# Nested`, 'utf-8')

      const skills = await discoverSkills(testDir, 'subdir/nested')

      expect(skills).toHaveLength(1)
      expect(skills[0]?.name).toBe('nested-skill')
    })

    it('should handle empty directory', async () => {
      const skills = await discoverSkills(testDir)

      expect(skills).toEqual([])
    })

    it('should handle non-existent directory', async () => {
      const skills = await discoverSkills(join(testDir, 'nonexistent'))

      expect(skills).toEqual([])
    })

    it('should respect max depth limit', async () => {
      // Create deeply nested skill (depth > 5)
      let deepDir = testDir
      for (let i = 0; i < 7; i++) {
        deepDir = join(deepDir, `level${i}`)
      }
      mkdirSync(deepDir, { recursive: true })

      writeFileSync(join(deepDir, 'SKILL.md'), `---
name: deep-skill
description: Too deep
---
# Deep`, 'utf-8')

      const skills = await discoverSkills(testDir)

      // Should not find the deeply nested skill
      expect(skills).toHaveLength(0)
    })
  })

  describe('getSkillDisplayName', () => {
    it('should return skill name', () => {
      const skill: Skill = {
        name: 'my-skill',
        description: 'Test',
        path: '/path/to/skill',
        rawContent: 'content'
      }

      expect(getSkillDisplayName(skill)).toBe('my-skill')
    })

    it('should return basename of path if name is empty', () => {
      const skill: Skill = {
        name: '',
        description: 'Test',
        path: '/path/to/skill-folder',
        rawContent: 'content'
      }

      expect(getSkillDisplayName(skill)).toBe('skill-folder')
    })
  })

  describe('filterSkills', () => {
    const skills: Skill[] = [
      {
        name: 'skill-one',
        description: 'First skill',
        path: '/path/one',
        rawContent: 'content1'
      },
      {
        name: 'skill-two',
        description: 'Second skill',
        path: '/path/two',
        rawContent: 'content2'
      },
      {
        name: 'special-skill',
        description: 'Special skill',
        path: '/path/special',
        rawContent: 'content3'
      }
    ]

    it('should filter skills by exact name match', () => {
      const filtered = filterSkills(skills, ['skill-one'])

      expect(filtered).toHaveLength(1)
      expect(filtered[0]?.name).toBe('skill-one')
    })

    it('should filter skills case-insensitively', () => {
      const filtered = filterSkills(skills, ['SKILL-ONE'])

      expect(filtered).toHaveLength(1)
      expect(filtered[0]?.name).toBe('skill-one')
    })

    it('should filter multiple skills', () => {
      const filtered = filterSkills(skills, ['skill-one', 'skill-two'])

      expect(filtered).toHaveLength(2)
      expect(filtered.map(s => s.name).sort()).toEqual(['skill-one', 'skill-two'])
    })

    it('should return empty array for no matches', () => {
      const filtered = filterSkills(skills, ['nonexistent'])

      expect(filtered).toEqual([])
    })

    it('should handle empty input names', () => {
      const filtered = filterSkills(skills, [])

      expect(filtered).toEqual([])
    })

    it('should match by display name', () => {
      const skillsWithPath: Skill[] = [
        {
          name: '',
          description: 'Test',
          path: '/path/to/my-folder',
          rawContent: 'content'
        }
      ]

      const filtered = filterSkills(skillsWithPath, ['my-folder'])

      expect(filtered).toHaveLength(1)
    })
  })
})
