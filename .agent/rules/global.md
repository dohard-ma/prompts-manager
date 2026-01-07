---
trigger: always_on
---

# 全局规则

## 终端与环境 (Terminal & Environment)

- **必须固定使用 Git Bash** 作为执行终端命令的 Shell。
- 项目环境依赖 `fnm` 进行 Node.js 版本自动切换，该配置仅在 Git Bash 中生效。
- 严禁使用 PowerShell 或默认的 Windows Command Prompt (cmd) 执行命令，以避免环境版本冲突（如 Node.js 版本不匹配导致的 Prisma 错误）。
- 使用 pnpm 来管理依赖

## 语言限制

- 所有回复和生成的文档必须使用**中文**