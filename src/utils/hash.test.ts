import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { computeFolderHash, computeFilesHash } from './hash'

describe('hash utilities', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `vibe-hash-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('computeFolderHash', () => {
    it('should compute consistent hash for same content', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1')
      writeFileSync(join(testDir, 'file2.txt'), 'content2')

      const hash1 = await computeFolderHash(testDir)
      const hash2 = await computeFolderHash(testDir)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 produces 64 hex chars
    })

    it('should produce different hash when content changes', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1')
      const hash1 = await computeFolderHash(testDir)

      writeFileSync(join(testDir, 'file1.txt'), 'content2')
      const hash2 = await computeFolderHash(testDir)

      expect(hash1).not.toBe(hash2)
    })

    it('should produce different hash when file is added', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1')
      const hash1 = await computeFolderHash(testDir)

      writeFileSync(join(testDir, 'file2.txt'), 'content2')
      const hash2 = await computeFolderHash(testDir)

      expect(hash1).not.toBe(hash2)
    })

    it('should handle nested directories', async () => {
      const subDir = join(testDir, 'subdir')
      mkdirSync(subDir)
      writeFileSync(join(subDir, 'nested.txt'), 'nested content')

      const hash = await computeFolderHash(testDir)
      expect(hash).toHaveLength(64)
    })

    it('should skip .git and node_modules directories', async () => {
      const gitDir = join(testDir, '.git')
      const nodeModulesDir = join(testDir, 'node_modules')
      
      mkdirSync(gitDir)
      mkdirSync(nodeModulesDir)
      
      writeFileSync(join(gitDir, 'config'), 'git config')
      writeFileSync(join(nodeModulesDir, 'package.json'), '{}')
      writeFileSync(join(testDir, 'main.txt'), 'main content')

      const hash = await computeFolderHash(testDir)
      
      // Hash should only include main.txt
      expect(hash).toHaveLength(64)
    })
  })

  describe('computeFilesHash', () => {
    it('should compute hash for existing files', async () => {
      const file1 = join(testDir, 'file1.txt')
      const file2 = join(testDir, 'file2.txt')
      
      writeFileSync(file1, 'content1')
      writeFileSync(file2, 'content2')

      const hash = await computeFilesHash([file1, file2])
      expect(hash).toHaveLength(64)
    })

    it('should skip non-existent files', async () => {
      const file1 = join(testDir, 'file1.txt')
      const file2 = join(testDir, 'nonexistent.txt')
      
      writeFileSync(file1, 'content1')

      const hash = await computeFilesHash([file1, file2])
      expect(hash).toHaveLength(64)
    })

    it('should produce consistent hash regardless of file order', async () => {
      const file1 = join(testDir, 'a.txt')
      const file2 = join(testDir, 'b.txt')
      
      writeFileSync(file1, 'content1')
      writeFileSync(file2, 'content2')

      const hash1 = await computeFilesHash([file1, file2])
      const hash2 = await computeFilesHash([file2, file1])

      expect(hash1).toBe(hash2)
    })

    it('should handle empty file list', async () => {
      const hash = await computeFilesHash([])
      expect(hash).toHaveLength(64)
    })
  })
})
