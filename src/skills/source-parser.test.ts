import { describe, it, expect } from 'vitest'
import { parseSource, getOwnerRepo } from './source-parser'

describe('source-parser', () => {
  describe('parseSource', () => {
    it('should parse GitHub shorthand', () => {
      const result = parseSource('owner/repo')
      
      expect(result).toEqual({
        type: 'github',
        url: 'https://github.com/owner/repo.git',
        subpath: undefined,
      })
    })

    it('should parse GitHub shorthand with subpath', () => {
      const result = parseSource('owner/repo/path/to/skill')
      
      expect(result).toEqual({
        type: 'github',
        url: 'https://github.com/owner/repo.git',
        subpath: 'path/to/skill',
      })
    })

    it('should parse GitHub URL', () => {
      const result = parseSource('https://github.com/owner/repo')
      
      expect(result).toEqual({
        type: 'github',
        url: 'https://github.com/owner/repo.git',
      })
    })

    it('should parse GitHub URL with .git extension', () => {
      const result = parseSource('https://github.com/owner/repo.git')
      
      expect(result).toEqual({
        type: 'github',
        url: 'https://github.com/owner/repo.git',
      })
    })

    it('should parse GitHub URL with branch', () => {
      const result = parseSource('https://github.com/owner/repo/tree/main')
      
      expect(result).toEqual({
        type: 'github',
        url: 'https://github.com/owner/repo.git',
        ref: 'main',
      })
    })

    it('should parse GitHub URL with branch and path', () => {
      const result = parseSource('https://github.com/owner/repo/tree/main/path/to/skill')
      
      expect(result).toEqual({
        type: 'github',
        url: 'https://github.com/owner/repo.git',
        ref: 'main',
        subpath: 'path/to/skill',
      })
    })

    it('should parse local relative path', () => {
      const result = parseSource('./local/path')
      
      expect(result).toEqual({
        type: 'local',
        url: './local/path',
        localPath: './local/path',
      })
    })

    it('should parse local parent path', () => {
      const result = parseSource('../parent/path')
      
      expect(result).toEqual({
        type: 'local',
        url: '../parent/path',
        localPath: '../parent/path',
      })
    })

    it('should parse Windows absolute path', () => {
      const result = parseSource('C:/Users/test/project')
      
      expect(result).toEqual({
        type: 'local',
        url: 'C:/Users/test/project',
        localPath: 'C:/Users/test/project',
      })
    })

    it('should parse current directory', () => {
      const result = parseSource('.')
      
      expect(result).toEqual({
        type: 'local',
        url: '.',
        localPath: '.',
      })
    })
  })

  describe('getOwnerRepo', () => {
    it('should extract owner/repo from GitHub URL', () => {
      const parsed = parseSource('https://github.com/owner/repo')
      const ownerRepo = getOwnerRepo(parsed)
      
      expect(ownerRepo).toBe('owner/repo')
    })

    it('should extract owner/repo from shorthand', () => {
      const parsed = parseSource('owner/repo')
      const ownerRepo = getOwnerRepo(parsed)
      
      expect(ownerRepo).toBe('owner/repo')
    })

    it('should return null for local paths', () => {
      const parsed = parseSource('./local/path')
      const ownerRepo = getOwnerRepo(parsed)
      
      expect(ownerRepo).toBeNull()
    })

    it('should handle .git extension', () => {
      const parsed = parseSource('https://github.com/owner/repo.git')
      const ownerRepo = getOwnerRepo(parsed)
      
      expect(ownerRepo).toBe('owner/repo')
    })
  })
})
