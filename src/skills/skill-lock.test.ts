import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getAllLockedSkills, getSkillsBySource } from './skill-lock'
import type { VibeLock } from '../types'

describe('skill-lock utilities', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `vibe-skill-lock-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  function createLockFile(lockData: VibeLock) {
    const lockDir = join(testDir, '.opencode')
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(
      join(lockDir, 'vibe-lock.json'),
      JSON.stringify(lockData, null, 2),
      'utf-8'
    )
  }

  describe('getAllLockedSkills', () => {
    it('should return empty object when no lock file exists', async () => {
      const skills = await getAllLockedSkills(testDir)

      expect(skills).toEqual({})
    })

    it('should return all locked skills', async () => {
      const lockData: VibeLock = {
        version: 1,
        skills: {
          'skill-1': {
            source: 'owner/repo1',
            sourceType: 'github',
            computedHash: 'hash1'
          },
          'skill-2': {
            source: 'owner/repo2',
            sourceType: 'github',
            computedHash: 'hash2'
          }
        },
        tools: {},
        rules: {},
        agents: {}
      }

      createLockFile(lockData)

      const skills = await getAllLockedSkills(testDir)

      expect(Object.keys(skills)).toHaveLength(2)
      expect(skills['skill-1']).toEqual({
        source: 'owner/repo1',
        sourceType: 'github',
        computedHash: 'hash1'
      })
      expect(skills['skill-2']).toEqual({
        source: 'owner/repo2',
        sourceType: 'github',
        computedHash: 'hash2'
      })
    })

    it('should return skills with skillPath', async () => {
      const lockData: VibeLock = {
        version: 1,
        skills: {
          'skill-with-path': {
            source: 'owner/repo',
            sourceType: 'github',
            skillPath: 'path/to/skill',
            computedHash: 'hash'
          }
        },
        tools: {},
        rules: {},
        agents: {}
      }

      createLockFile(lockData)

      const skills = await getAllLockedSkills(testDir)

      expect(skills['skill-with-path']?.skillPath).toBe('path/to/skill')
    })

    it('should handle lock file without skills field', async () => {
      const lockData = {
        version: 1,
        tools: {},
        rules: {}
      } as VibeLock

      createLockFile(lockData)

      const skills = await getAllLockedSkills(testDir)

      expect(skills).toEqual({})
    })
  })

  describe('getSkillsBySource', () => {
    it('should return empty map when no lock file exists', async () => {
      const bySource = await getSkillsBySource(testDir)

      expect(bySource.size).toBe(0)
    })

    it('should group skills by source', async () => {
      const lockData: VibeLock = {
        version: 1,
        skills: {
          'skill-1': {
            source: 'owner/repo1',
            sourceType: 'github',
            computedHash: 'hash1'
          },
          'skill-2': {
            source: 'owner/repo1',
            sourceType: 'github',
            computedHash: 'hash2'
          },
          'skill-3': {
            source: 'owner/repo2',
            sourceType: 'github',
            computedHash: 'hash3'
          }
        },
        tools: {},
        rules: {},
        agents: {}
      }

      createLockFile(lockData)

      const bySource = await getSkillsBySource(testDir)

      expect(bySource.size).toBe(2)
      
      const repo1Skills = bySource.get('owner/repo1')
      expect(repo1Skills).toBeDefined()
      expect(repo1Skills?.skills).toHaveLength(2)
      expect(repo1Skills?.skills.sort()).toEqual(['skill-1', 'skill-2'])
      expect(repo1Skills?.entry.source).toBe('owner/repo1')

      const repo2Skills = bySource.get('owner/repo2')
      expect(repo2Skills).toBeDefined()
      expect(repo2Skills?.skills).toHaveLength(1)
      expect(repo2Skills?.skills).toEqual(['skill-3'])
    })

    it('should preserve entry metadata', async () => {
      const lockData: VibeLock = {
        version: 1,
        skills: {
          'skill-1': {
            source: 'owner/repo',
            sourceType: 'github',
            skillPath: 'custom/path',
            computedHash: 'hash1'
          }
        },
        tools: {},
        rules: {},
        agents: {}
      }

      createLockFile(lockData)

      const bySource = await getSkillsBySource(testDir)

      const entry = bySource.get('owner/repo')
      expect(entry?.entry.skillPath).toBe('custom/path')
      expect(entry?.entry.sourceType).toBe('github')
      expect(entry?.entry.computedHash).toBe('hash1')
    })

    it('should handle single skill per source', async () => {
      const lockData: VibeLock = {
        version: 1,
        skills: {
          'skill-1': {
            source: 'owner/repo1',
            sourceType: 'github'
          },
          'skill-2': {
            source: 'owner/repo2',
            sourceType: 'github'
          }
        },
        tools: {},
        rules: {},
        agents: {}
      }

      createLockFile(lockData)

      const bySource = await getSkillsBySource(testDir)

      expect(bySource.size).toBe(2)
      expect(bySource.get('owner/repo1')?.skills).toEqual(['skill-1'])
      expect(bySource.get('owner/repo2')?.skills).toEqual(['skill-2'])
    })

    it('should handle lock file without skills', async () => {
      const lockData: VibeLock = {
        version: 1,
        skills: {},
        tools: {},
        rules: {},
        agents: {}
      }

      createLockFile(lockData)

      const bySource = await getSkillsBySource(testDir)

      expect(bySource.size).toBe(0)
    })

    it('should handle different source types', async () => {
      const lockData: VibeLock = {
        version: 1,
        skills: {
          'github-skill': {
            source: 'owner/repo',
            sourceType: 'github'
          },
          'local-skill': {
            source: '/local/path',
            sourceType: 'local'
          }
        },
        tools: {},
        rules: {},
        agents: {}
      }

      createLockFile(lockData)

      const bySource = await getSkillsBySource(testDir)

      expect(bySource.size).toBe(2)
      expect(bySource.get('owner/repo')?.entry.sourceType).toBe('github')
      expect(bySource.get('/local/path')?.entry.sourceType).toBe('local')
    })
  })
})
