// ==========================================
// Vercel Skills 生态相关常量
// ==========================================
export const AGENTS_DIR = ".agents"
export const SKILLS_SUBDIR = "skills"
export const UNIVERSAL_SKILLS_DIR = ".agents/skills"

// ==========================================
// OpenCode 生态专属常量
// ==========================================
export const OPENCODE_DIR = ".opencode"
export const TOOL_SUBDIR = "tool"
export const RULES_SUBDIR = "rules"
export const AGENTS_SUBDIR = "agents"
export const LOCK_FILE = "vibe-lock.json"
export const CONFIG_FILE = "opencode.jsonc"

// ==========================================
// Git 相关常量
// ==========================================
export const CLONE_TIMEOUT_MS = 60000 // 60 seconds
export const GIT_TERMINAL_PROMPT = "0"

// ==========================================
// 文件排除规则
// ==========================================
export const EXCLUDE_FILES = new Set(['metadata.json'])
export const EXCLUDE_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv'])
export const EXCLUDE_FILE_PREFIXES = ['_']

// ==========================================
// 颜色定义
// ==========================================
export const BOLD = "\x1b[1m"
export const RESET = "\x1b[0m"
export const CYAN = "\x1b[36m"
export const BG_CYAN = "\x1b[46m\x1b[30m"
export const GREEN = "\x1b[32m"
export const YELLOW = "\x1b[33m"
export const DIM = "\x1b[38;5;102m"
export const TEXT = "\x1b[38;5;145m"
