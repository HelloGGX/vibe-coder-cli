import * as p from "@clack/prompts"
import { YELLOW, RESET } from "../constants"

export enum ErrorSeverity {
  WARN = 'warn',
  ERROR = 'error',
  INFO = 'info'
}

export function handleExecError(
  error: unknown, 
  context: string, 
  severity: ErrorSeverity = ErrorSeverity.WARN
): void {
  // 提取错误信息，兼容非 Error 对象的抛出
  const message = error instanceof Error ? error.message : String(error)
  const formatted = `${context}\n${YELLOW}${message}${RESET}` // 增加颜色区分度
  
  switch (severity) {
    case ErrorSeverity.ERROR:
      p.log.error(formatted)
      process.exit(1) // 致命错误，直接退出进程
    case ErrorSeverity.WARN:
      p.log.warn(formatted)
      break
    default:
      p.log.info(formatted)
  }
}