import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorSeverity, handleExecError } from './error'
import * as p from '@clack/prompts'

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

describe('error utilities', () => {
  let mockExit: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock process.exit to prevent test from actually exiting
    mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
  })

  afterEach(() => {
    mockExit.mockRestore()
  })

  describe('ErrorSeverity', () => {
    it('should have correct enum values', () => {
      expect(ErrorSeverity.WARN).toBe('warn')
      expect(ErrorSeverity.ERROR).toBe('error')
      expect(ErrorSeverity.INFO).toBe('info')
    })
  })

  describe('handleExecError', () => {
    it('should log error and exit for ERROR severity', () => {
      const error = new Error('Test error')
      
      handleExecError(error, 'Test Context', ErrorSeverity.ERROR)

      expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Test Context'))
      expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Test error'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should log warning for WARN severity', () => {
      const error = new Error('Warning message')
      
      handleExecError(error, 'Warning Context', ErrorSeverity.WARN)

      expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Warning Context'))
      expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Warning message'))
      expect(mockExit).not.toHaveBeenCalled()
    })

    it('should log info for INFO severity', () => {
      const error = new Error('Info message')
      
      handleExecError(error, 'Info Context', ErrorSeverity.INFO)

      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Info Context'))
      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Info message'))
      expect(mockExit).not.toHaveBeenCalled()
    })

    it('should default to WARN severity', () => {
      const error = new Error('Default severity')
      
      handleExecError(error, 'Default Context')

      expect(p.log.warn).toHaveBeenCalled()
      expect(mockExit).not.toHaveBeenCalled()
    })

    it('should handle non-Error objects', () => {
      const errorString = 'String error'
      
      handleExecError(errorString, 'String Context', ErrorSeverity.WARN)

      expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('String error'))
    })

    it('should handle null/undefined errors', () => {
      handleExecError(null, 'Null Context', ErrorSeverity.INFO)

      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('null'))
    })

    it('should handle objects without message property', () => {
      const errorObj = { code: 'ERR_001', details: 'Some details' }
      
      handleExecError(errorObj, 'Object Context', ErrorSeverity.WARN)

      expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Object Context'))
    })

    it('should include context in formatted message', () => {
      const error = new Error('Test')
      
      handleExecError(error, 'Important Context', ErrorSeverity.INFO)

      expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Important Context'))
    })

    it('should format message with color codes', () => {
      const error = new Error('Colored error')
      
      handleExecError(error, 'Context', ErrorSeverity.WARN)

      const callArg = (p.log.warn as any).mock.calls[0][0]
      // Should contain ANSI color codes (YELLOW and RESET)
      expect(callArg).toContain('\x1b[')
    })
  })
})
