import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  readLockFile,
  writeLockFile,
  updateLockFile,
  batchUpdateLockFile,
  ensureOpencodeConfig,
  updateOpencodeConfig,
  removeOpencodeConfig,
} from './config'
import type { VibeLock } from '../types'

describe('config utilities', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `vibe-config-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('readLockFile', () => {
    it('should return empty lock file when file does not exist', () => {
      const lock = readLockFile(testDir)
      
      expect(lock).toEqual({
        version: 1,
        skills: {},
        tools: {},
        rules: {},
        agents: {}
      })
    })

    it('should read existing lock file', () => {
      const lockDir = join(testDir, '.opencode')
      mkdirSync(lockDir, { recursive: true })
      
      const lockData: VibeLock = {
        version: 1,
        skills: { 'test-skill': { source: 'test/repo', sourceType: 'github' } },
        tools: { 'test-tool': { source: 'test/repo', sourceType: 'github' } },
        rules: {},
        agents: {}
      }
      
      writeFileSync(
        join(lockDir, 'vibe-lock.json'),
        JSON.stringify(lockData, null, 2)
      )

      const lock = readLockFile(testDir)
      expect(lock).toEqual(lockData)
    })

    it('should handle missing fields in lock file', () => {
      const lockDir = join(testDir, '.opencode')
      mkdirSync(lockDir, { recursive: true })
      
      writeFileSync(
        join(lockDir, 'vibe-lock.json'),
        JSON.stringify({ version: 1 })
      )

      const lock = readLockFile(testDir)
      expect(lock.skills).toEqual({})
      expect(lock.tools).toEqual({})
      expect(lock.rules).toEqual({})
    })
  })

  describe('writeLockFile', () => {
    it('should write lock file with sorted entries', () => {
      const lockData: VibeLock = {
        version: 1,
        skills: {
          'z-skill': { source: 'test/z', sourceType: 'github' },
          'a-skill': { source: 'test/a', sourceType: 'github' },
        },
        tools: {},
        rules: {},
        agents: {}
      }

      writeLockFile(lockData, testDir)

      const lockPath = join(testDir, '.opencode', 'vibe-lock.json')
      expect(existsSync(lockPath)).toBe(true)

      const content = readFileSync(lockPath, 'utf-8')
      const parsed = JSON.parse(content)
      
      const skillKeys = Object.keys(parsed.skills)
      expect(skillKeys).toEqual(['a-skill', 'z-skill'])
    })

    it('should add trailing newline', () => {
      const lockData: VibeLock = {
        version: 1,
        skills: {},
        tools: {},
        rules: {},
        agents: {}
      }

      writeLockFile(lockData, testDir)

      const lockPath = join(testDir, '.opencode', 'vibe-lock.json')
      const content = readFileSync(lockPath, 'utf-8')
      
      expect(content.endsWith('\n')).toBe(true)
    })
  })

  describe('updateLockFile', () => {
    it('should update lock file transactionally', () => {
      updateLockFile((lock) => {
        lock.tools['new-tool'] = { source: 'test/repo', sourceType: 'github' }
      }, testDir)

      const lock = readLockFile(testDir)
      expect(lock.tools['new-tool']).toEqual({
        source: 'test/repo',
        sourceType: 'github',
      })
    })
  })

  describe('batchUpdateLockFile', () => {
    it('should add multiple entries', () => {
      batchUpdateLockFile({
        skills: {
          'skill1': { source: 'test/repo1', sourceType: 'github' },
          'skill2': { source: 'test/repo2', sourceType: 'github' },
        },
        tools: {
          'tool1': { source: 'test/repo1', sourceType: 'github' },
        },
      }, testDir)

      const lock = readLockFile(testDir)
      expect(Object.keys(lock.skills)).toHaveLength(2)
      expect(Object.keys(lock.tools)).toHaveLength(1)
    })

    it('should remove entries', () => {
      // First add some entries
      batchUpdateLockFile({
        skills: {
          'skill1': { source: 'test/repo1', sourceType: 'github' },
          'skill2': { source: 'test/repo2', sourceType: 'github' },
        },
      }, testDir)

      // Then remove one
      batchUpdateLockFile({
        removeSkills: ['skill1'],
      }, testDir)

      const lock = readLockFile(testDir)
      expect(lock.skills['skill1']).toBeUndefined()
      expect(lock.skills['skill2']).toBeDefined()
    })
  })

  describe('ensureOpencodeConfig', () => {
    it('should create config file if not exists', () => {
      ensureOpencodeConfig(testDir)

      const configPath = join(testDir, '.opencode', 'opencode.jsonc')
      expect(existsSync(configPath)).toBe(true)
    })

    it('should not overwrite existing config', () => {
      const configDir = join(testDir, '.opencode')
      mkdirSync(configDir, { recursive: true })
      
      const customConfig = '{"custom": true}'
      writeFileSync(join(configDir, 'opencode.jsonc'), customConfig)

      ensureOpencodeConfig(testDir)

      const content = readFileSync(join(configDir, 'opencode.jsonc'), 'utf-8')
      expect(content).toBe(customConfig)
    })
  })

  describe('updateOpencodeConfig', () => {
    beforeEach(() => {
      ensureOpencodeConfig(testDir)
    })

    it('should add tools to config', () => {
      updateOpencodeConfig(['tool1', 'tool2'], [], testDir)

      const configPath = join(testDir, '.opencode', 'opencode.jsonc')
      const content = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content)

      expect(config.tools['tool1']).toBe(true)
      expect(config.tools['tool2']).toBe(true)
    })

    it('should add instructions to config', () => {
      updateOpencodeConfig([], ['./rules/common/style.md'], testDir)

      const configPath = join(testDir, '.opencode', 'opencode.jsonc')
      const content = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content)

      expect(config.instructions).toContain('./rules/common/style.md')
    })

    it('should not add duplicate entries', () => {
      updateOpencodeConfig(['tool1'], [], testDir)
      updateOpencodeConfig(['tool1'], [], testDir)

      const configPath = join(testDir, '.opencode', 'opencode.jsonc')
      const content = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content)

      expect(Object.keys(config.tools).filter(k => k === 'tool1')).toHaveLength(1)
    })
  })

  describe('removeOpencodeConfig', () => {
    beforeEach(() => {
      ensureOpencodeConfig(testDir)
      updateOpencodeConfig(['tool1', 'tool2'], ['./rules/typescript/style.md'], testDir)
    })

    it('should remove tools from config', () => {
      removeOpencodeConfig(['tool1'], [], testDir)

      const configPath = join(testDir, '.opencode', 'opencode.jsonc')
      const content = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content)

      expect(config.tools['tool1']).toBeUndefined()
      expect(config.tools['tool2']).toBe(true)
    })

    it('should remove instructions from config', () => {
      removeOpencodeConfig([], ['typescript'], testDir)

      const configPath = join(testDir, '.opencode', 'opencode.jsonc')
      const content = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content)

      expect(config.instructions).not.toContain('./rules/typescript/style.md')
    })
  })
})
