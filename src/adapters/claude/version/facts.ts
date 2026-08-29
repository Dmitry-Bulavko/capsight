/**
 * Verified platform facts (SPEC §3) modelled as data: id, section, statement,
 * trust level. The trust level is transcribed verbatim from the §3 tables —
 * `[doc]` → "doc", `[ext]` → "ext", `[spike]` → "spike". A fact is never
 * upgraded because resolver code happens to rely on it (SPEC §0.1.1, §8.2).
 *
 * Registration is descriptive only: listing a fact here does not implement it
 * and never makes a capability `enforced`. Enforcement is decided by the
 * resolver and the version matrix, not by this registry.
 *
 * Statements are quoted from docs/SPEC.md §3 in the original wording.
 *
 * §3.11 rows carry no ids in the SPEC. Convention used here: `E<n>`, numbered
 * in §3.11 table order, with the environment variable recorded in `envVar` —
 * the id is bound to the variable, not to the row position.
 *
 * @see docs/SPEC.md §3
 */

/** Trust level of a §3 fact. */
export type FactConfidence = "doc" | "ext" | "spike";

export interface Fact {
  /** Fact id as used by `matrixRef` / `factRefs` (e.g. "F2"). */
  readonly id: string;
  /** SPEC subsection the fact is transcribed from (e.g. "3.2"). */
  readonly section: string;
  /** Fact text as written in §3. */
  readonly statement: string;
  /** Trust level from the §3 table — never inferred from resolver usage. */
  readonly confidence: FactConfidence;
  /** §3.11 only: the environment variable (or settings block) the id is bound to. */
  readonly envVar?: string;
}

export const FACTS = [
  // §3.1 Обнаружение агентов
  {
    id: "A1",
    section: "3.1",
    statement:
      "Приоритет при совпадении `name`: managed settings > `--agents` CLI > `.claude/agents/` > `~/.claude/agents/` > plugin `agents/`",
    confidence: "doc",
  },
  {
    id: "A2",
    section: "3.1",
    statement:
      "Проектные агенты ищутся обходом вверх от cwd; сканируется каждый `.claude/agents/` между cwd и корнем репозитория",
    confidence: "doc",
  },
  {
    id: "A3",
    section: "3.1",
    statement:
      "При совпадении `name` во вложенных проектных директориях побеждает ближайшая к cwd (v2.1.178+)",
    confidence: "doc",
  },
  {
    id: "A4",
    section: "3.1",
    statement:
      "При совпадении `name` внутри одной директории (включая её подпапки) загружается только один файл; выбор — по порядку чтения ФС, документированного правила нет",
    confidence: "doc",
  },
  {
    id: "A5",
    section: "3.1",
    statement:
      "Директории агентов сканируются рекурсивно; идентичность определяется только полем `name`, путь подпапки не влияет",
    confidence: "doc",
  },
  {
    id: "A6",
    section: "3.1",
    statement:
      "Для плагинов подпапка входит в scoped id: `agents/review/security.md` в плагине `my-plugin` → `my-plugin:review:security`",
    confidence: "doc",
  },
  {
    id: "A7",
    section: "3.1",
    statement:
      "Файл пропускается молча, если: нет `name`; `name` начинается с `-` или содержит `:`; есть `name`, но нет `description`; YAML не парсится. Причина пишется только в debug-лог",
    confidence: "doc",
  },
  {
    id: "A8",
    section: "3.1",
    statement:
      "Plugin-агент без `name` или с непарсящимся frontmatter всё равно загружается — под именем файла",
    confidence: "doc",
  },
  {
    id: "A9",
    section: "3.1",
    statement:
      "`--add-dir` подключает `.claude/agents/` добавленной директории, но не остальную конфигурацию",
    confidence: "doc",
  },
  {
    id: "A10",
    section: "3.1",
    statement:
      "Суммарный размер `description` пользовательских агентов свыше 15 000 токенов вызывает предупреждение при старте Claude Code",
    confidence: "doc",
  },

  // §3.2 Frontmatter агента
  {
    id: "F1",
    section: "3.2",
    statement:
      "Обязательные поля: `name`, `description`. Опциональные: `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `effort`, `isolation`, `color`, `initialPrompt`",
    confidence: "doc",
  },
  {
    id: "F2",
    section: "3.2",
    statement:
      "`disallowedTools` применяется первым, затем `tools` резолвится против остатка. Инструмент в обоих списках удаляется",
    confidence: "doc",
  },
  {
    id: "F3",
    section: "3.2",
    statement:
      "Оба поля принимают точные имена инструментов и серверные паттерны `mcp__<server>`, `mcp__<server>__*`. В `disallowedTools` дополнительно работает `mcp__*` (все MCP-инструменты)",
    confidence: "doc",
  },
  {
    id: "F4",
    section: "3.2",
    statement:
      "Если ни один элемент `tools` не резолвится в инструмент, субагент не запускается, Agent-инструмент возвращает ошибку (v2.1.208+)",
    confidence: "doc",
  },
  {
    id: "F5",
    section: "3.2",
    statement:
      "Синтаксис `Agent(type1, type2)` в `tools` действует только когда агент запущен как main session через `--agent`. Внутри определения субагента список типов в скобках игнорируется",
    confidence: "doc",
  },
  {
    id: "F6",
    section: "3.2",
    statement:
      "Отсутствие `Agent` в `tools` полностью лишает агента возможности порождать субагентов",
    confidence: "doc",
  },
  {
    id: "F7",
    section: "3.2",
    statement:
      "`model` по умолчанию `inherit`. Порядок разрешения: `CLAUDE_CODE_SUBAGENT_MODEL` → per-invocation параметр → frontmatter → модель основной сессии",
    confidence: "doc",
  },
  {
    id: "F8",
    section: "3.2",
    statement:
      "Значения `model` проверяются против организационного allowlist `availableModels`; при блокировке происходит подстановка другой модели",
    confidence: "doc",
  },
  {
    id: "F9",
    section: "3.2",
    statement:
      "Для plugin-агентов поля `hooks`, `mcpServers`, `permissionMode` игнорируются",
    confidence: "doc",
  },
  {
    id: "F10",
    section: "3.2",
    statement:
      "`initialPrompt` применяется только когда агент запущен как main session (`--agent` или настройка `agent`)",
    confidence: "doc",
  },
  {
    id: "F11",
    section: "3.2",
    statement:
      "Инструмент `Task` переименован в `Agent` в v2.1.63; `Task(...)` остаётся рабочим алиасом",
    confidence: "doc",
  },

  // §3.3 Фильтры набора инструментов по контексту
  {
    id: "T1",
    section: "3.3",
    statement:
      "Фильтр 1 (все субагенты, даже если инструмент указан в `tools`) удаляет: `Agent` (на пределе глубины), `AskUserQuestion`, `EndConversation`, `EnterPlanMode`, `ExitPlanMode` (кроме `permissionMode: plan`), `ScheduleWakeup`, `TaskOutput`, `WaitForMcpServers`, `Workflow`",
    confidence: "doc",
  },
  {
    id: "T2",
    section: "3.3",
    statement:
      "Фильтр 2 (фоновые субагенты) сохраняет все MCP-инструменты, но из встроенных оставляет только: `Read`, `Grep`, `Glob`, `Bash`, `PowerShell`, `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`, `TodoWrite`, `Skill`, `ToolSearch`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `TaskStop`, `SendMessage`, `Artifact`",
    confidence: "doc",
  },
  {
    id: "T3",
    section: "3.3",
    statement:
      "Форк пропускает оба фильтра и получает точный пул инструментов родительской сессии, её системный промпт, модель и историю",
    confidence: "doc",
  },
  {
    id: "T4",
    section: "3.3",
    statement:
      "Teammates в agent teams дополнительно сохраняют `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`, `CronCreate`, `CronDelete`, `CronList`",
    confidence: "doc",
  },
  {
    id: "T5",
    section: "3.3",
    statement:
      "Одно и то же определение агента резолвится в разный набор инструментов в foreground и background",
    confidence: "doc",
  },
  {
    id: "T6",
    section: "3.3",
    statement:
      "Фоновый режим — поведение по умолчанию в интерактивной сессии при включённом fork mode (v2.1.232+)",
    confidence: "doc",
  },

  // §3.4 Permission mode
  {
    id: "P1",
    section: "3.4",
    statement:
      "Если родитель в `bypassPermissions` или `acceptEdits` — это имеет приоритет и не переопределяется frontmatter'ом субагента",
    confidence: "doc",
  },
  {
    id: "P2",
    section: "3.4",
    statement:
      "Если родитель в `auto` — субагент наследует `auto`, а `permissionMode` во frontmatter игнорируется",
    confidence: "doc",
  },
  {
    id: "P3",
    section: "3.4",
    statement:
      "`auto` — стартовый режим по умолчанию на планах Pro, Max и Team, если настройки или организация не меняют его",
    confidence: "doc",
  },
  {
    id: "P4",
    section: "3.4",
    statement:
      "При `permissions.disableBypassPermissionsMode` frontmatter-значение `bypassPermissions` игнорируется (v2.1.223+)",
    confidence: "doc",
  },
  {
    id: "P5",
    section: "3.4",
    statement:
      "Режимы: `default` (manual), `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`",
    confidence: "doc",
  },

  // §3.5 Permissions (settings)
  {
    id: "S1",
    section: "3.5",
    statement:
      "Приоритет файлов настроек: managed > command line > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`",
    confidence: "ext",
  },
  {
    id: "S2",
    section: "3.5",
    statement:
      "Правила мержатся по всем скоупам; `deny` на любом уровне не переопределяется нигде, включая bypass-режим",
    confidence: "ext",
  },
  {
    id: "S3",
    section: "3.5",
    statement:
      "MCP-правила не поддерживают скобочный синтаксис: `mcp__server(pattern)` невалидно. Валидно: `mcp__server`, `mcp__server__tool`, `mcp__server__*`",
    confidence: "ext",
  },
  {
    id: "S4",
    section: "3.5",
    statement:
      "В `allow` неякорные глобы (`*`, `mcp__*`) игнорируются и ничего не разрешают",
    confidence: "ext",
  },
  {
    id: "S5",
    section: "3.5",
    statement:
      "`deny` на голое имя инструмента (`\"Bash\"`) полностью убирает инструмент из контекста",
    confidence: "ext",
  },
  {
    id: "S6",
    section: "3.5",
    statement:
      "`Bash(cmd:*)` — префиксное сопоставление; `:*` распознаётся только в конце паттерна",
    confidence: "ext",
  },
  {
    id: "S7",
    section: "3.5",
    statement:
      "`Read`/`Edit` используют gitignore-подобные глобы; ведущий `/` — корень проекта, `//` — абсолютный путь",
    confidence: "ext",
  },
  {
    id: "S8",
    section: "3.5",
    statement: "`WebFetch`-правила требуют префикса `domain:`",
    confidence: "ext",
  },
  {
    id: "S9",
    section: "3.5",
    statement:
      "Запрет субагентов: `permissions.deny: [\"Agent(<name>)\"]`, работает для встроенных и пользовательских",
    confidence: "doc",
  },
  {
    id: "S10",
    section: "3.5",
    statement:
      "Запрет скиллов: `Skill` (все), `Skill(<name>)` / `Skill(<name> *)` (конкретный)",
    confidence: "ext",
  },
  {
    id: "S11",
    section: "3.5",
    statement:
      "`additionalDirectories` расширяет файловый доступ; `enableAllProjectMcpServers` автоодобряет серверы из `.mcp.json`",
    confidence: "ext",
  },

  // §3.6 Skills
  {
    id: "K1",
    section: "3.6",
    statement:
      "`skills:` во frontmatter агента — преload полного содержимого скилла в контекст, а не allowlist доступа",
    confidence: "doc",
  },
  {
    id: "K2",
    section: "3.6",
    statement:
      "Без `skills:` субагент всё равно обнаруживает и вызывает project/user/plugin-скиллы через инструмент `Skill` (v2.1.133+)",
    confidence: "doc",
  },
  {
    id: "K3",
    section: "3.6",
    statement:
      "Полный запрет скиллов для агента — только через отсутствие `Skill` в `tools` или наличие в `disallowedTools`. Нативного per-agent allowlist скиллов не существует",
    confidence: "doc",
  },
  {
    id: "K4",
    section: "3.6",
    statement: "Нельзя преload'ить скилл с `disable-model-invocation: true`",
    confidence: "doc",
  },
  {
    id: "K5",
    section: "3.6",
    statement:
      "Отсутствующий или отключённый скилл в `skills:` пропускается с записью в debug-лог",
    confidence: "doc",
  },
  {
    id: "K6",
    section: "3.6",
    statement:
      "`allowed-tools` в SKILL.md — пре-одобрение инструментов, а не ограничение. Остальные инструменты остаются вызываемыми, permission-настройки продолжают действовать",
    confidence: "doc",
  },
  {
    id: "K7",
    section: "3.6",
    statement:
      "`allowed-tools` проектного скилла применяется при любом вызове скилла, включая `-p` в никогда не доверенной папке",
    confidence: "doc",
  },
  {
    id: "K8",
    section: "3.6",
    statement: "Глобальные `deny`-правила всегда побеждают `allowed-tools`",
    confidence: "ext",
  },
  {
    id: "K9",
    section: "3.6",
    statement:
      "`disallowed-tools` в SKILL.md убирает инструменты из пула на время активности скилла",
    confidence: "doc",
  },
  {
    id: "K10",
    section: "3.6",
    statement:
      "Настройка `skillOverrides` позволяет управлять скиллами из settings без правки файла скилла",
    confidence: "ext",
  },
  {
    id: "K11",
    section: "3.6",
    statement:
      "`.claude/commands/*.md` продолжает работать; при совпадении имени `.claude/skills/` имеет приоритет",
    confidence: "ext",
  },
  {
    id: "K12",
    section: "3.6",
    statement:
      "`--add-dir` подключает `.claude/skills/` добавленной директории (осознанное исключение из A9)",
    confidence: "ext",
  },

  // §3.7 Trust
  {
    id: "R1",
    section: "3.7",
    statement:
      "Inline-определения MCP-серверов в файле агента из проектного `.claude/agents/` (или из `.claude/agents/` директории `--add-dir`) загружаются только после принятия trust для папки, откуда пришёл файл агента",
    confidence: "doc",
  },
  {
    id: "R2",
    section: "3.7",
    statement:
      "Trust родительской папки не засчитывается; автоматический trust, который `-p`/SDK-сессия получает для хуков в settings-файлах, тоже не засчитывается",
    confidence: "doc",
  },
  {
    id: "R3",
    section: "3.7",
    statement:
      "Без trust Claude Code пропускает inline-серверы и пишет в debug-лог точный ключ `projects[\"<path>\"].hasTrustDialogAccepted` для `~/.claude.json`",
    confidence: "doc",
  },
  {
    id: "R4",
    section: "3.7",
    statement:
      "Без проверки trust загружаются: ссылка по имени на уже сконфигурированный сервер; inline-сервер из `~/.claude/agents/`; из `--agents`/SDK; из managed settings",
    confidence: "doc",
  },
  {
    id: "R5",
    section: "3.7",
    statement:
      "Frontmatter-хуки проектного агента требуют принятого trust для содержащей папки; хуки user-level агентов и `--agents` работают без этого",
    confidence: "doc",
  },
  {
    id: "R6",
    section: "3.7",
    statement:
      "Директория, добавленная через `--add-dir` из-за пределов доверенного репозитория, требует отдельной записи trust",
    confidence: "doc",
  },

  // §3.8 Инструкции (CLAUDE.md)
  {
    id: "I1",
    section: "3.8",
    statement:
      "Кастомный субагент получает все уровни иерархии CLAUDE.md, которые грузит основная сессия: `~/.claude/CLAUDE.md`, project rules, `CLAUDE.local.md`, managed policy files",
    confidence: "doc",
  },
  {
    id: "I2",
    section: "3.8",
    statement:
      "Explore и Plan не загружают CLAUDE.md и git status. Поля frontmatter или настройки для изменения этого не существует",
    confidence: "doc",
  },
  {
    id: "I3",
    section: "3.8",
    statement:
      "Селективное назначение инструкций конкретному агенту платформой не поддерживается",
    confidence: "doc",
  },
  {
    id: "I4",
    section: "3.8",
    statement:
      "Субагент получает системный промпт из тела своего файла плюс базовые сведения об окружении, а не полный системный промпт Claude Code",
    confidence: "doc",
  },
  {
    id: "I5",
    section: "3.8",
    statement:
      "Git status — снимок на момент старта родительской сессии; отсутствует вне git-репозитория и при `includeGitInstructions: false`",
    confidence: "doc",
  },

  // §3.9 Встроенные агенты
  {
    id: "B1",
    section: "3.9",
    statement:
      "Встроенные: `Explore`, `Plan`, `general-purpose`, `claude`, `statusline-setup`, `claude-code-guide`",
    confidence: "doc",
  },
  {
    id: "B2",
    section: "3.9",
    statement:
      "Explore и Plan: только read-only инструменты, `Write` и `Edit` запрещены",
    confidence: "doc",
  },
  {
    id: "B3",
    section: "3.9",
    statement:
      "Explore наследует модель основной сессии (v2.1.198+), на Claude API ограничена сверху Opus",
    confidence: "doc",
  },
  {
    id: "B4",
    section: "3.9",
    statement:
      "Пользовательский агент с именем `Explore` переопределяет встроенный и сохраняет своё поле `model`",
    confidence: "doc",
  },
  {
    id: "B5",
    section: "3.9",
    statement:
      "`CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` убирает только Explore и Plan (v2.1.198+)",
    confidence: "doc",
  },
  {
    id: "B6",
    section: "3.9",
    statement:
      "`CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` убирает все встроенные типы в non-interactive и SDK",
    confidence: "doc",
  },

  // §3.10 Вложенность и параллелизм
  {
    id: "N1",
    section: "3.10",
    statement:
      "По умолчанию субагент может порождать субагентов до 3 слоёв ниже основной сессии (v2.1.219+)",
    confidence: "doc",
  },
  {
    id: "N2",
    section: "3.10",
    statement:
      "На пределе глубины `Agent` изымается у всех, кроме форка; у форка инструмент остаётся в списке, но возвращает ошибку",
    confidence: "doc",
  },
  {
    id: "N3",
    section: "3.10",
    statement:
      "`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` меняет предел; `1` отключает вложенность",
    confidence: "doc",
  },
  {
    id: "N4",
    section: "3.10",
    statement:
      "Предел одновременных субагентов — 20, меняется через `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (v2.1.217+)",
    confidence: "doc",
  },
  {
    id: "N5",
    section: "3.10",
    statement:
      "Исторические значения предела глубины: v2.1.172–2.1.216 — 5 без возможности изменить; v2.1.217–2.1.218 — 1; v2.1.219+ — 3",
    confidence: "doc",
  },

  // §3.11 Переменные окружения, влияющие на резолюцию (ids assigned here, see header)
  {
    id: "E1",
    section: "3.11",
    envVar: "CLAUDE_CODE_DISABLE_BACKGROUND_TASKS",
    statement:
      "`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`: все субагенты в foreground → применяется только Фильтр 1",
    confidence: "doc",
  },
  {
    id: "E2",
    section: "3.11",
    envVar: "CLAUDE_CODE_FORK_SUBAGENT",
    statement:
      "`CLAUDE_CODE_FORK_SUBAGENT`: `1` включает fork mode в non-interactive/SDK, `0` выключает везде",
    confidence: "doc",
  },
  {
    id: "E3",
    section: "3.11",
    envVar: "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH",
    statement:
      "`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`: предел вложенности → доступность `Agent`",
    confidence: "doc",
  },
  {
    id: "E4",
    section: "3.11",
    envVar: "CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS",
    statement:
      "`CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1`: убирает Explore и Plan",
    confidence: "doc",
  },
  {
    id: "E5",
    section: "3.11",
    envVar: "CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS",
    statement:
      "`CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1`: убирает все встроенные типы",
    confidence: "doc",
  },
  {
    id: "E6",
    section: "3.11",
    envVar: "CLAUDE_CODE_SUBAGENT_MODEL",
    statement:
      "`CLAUDE_CODE_SUBAGENT_MODEL`: переопределяет модель субагентов; `inherit` = как не задано (v2.1.196+)",
    confidence: "doc",
  },
  {
    id: "E7",
    section: "3.11",
    envVar: "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS",
    statement:
      "`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`: предел параллельных субагентов",
    confidence: "doc",
  },
  {
    id: "E8",
    section: "3.11",
    envVar: "CLAUDE_CODE_DISABLE_AUTO_MEMORY",
    statement:
      "`CLAUDE_CODE_DISABLE_AUTO_MEMORY`: отключает `memory` во frontmatter",
    confidence: "doc",
  },
  {
    id: "E9",
    section: "3.11",
    envVar: "settings.json:env",
    statement:
      "Блок `env` в settings.json: инжектируется в каждую сессию и вызов инструмента",
    confidence: "ext",
  },

  // §3.12 Прочее
  {
    id: "M1",
    section: "3.12",
    statement:
      "`.claude/agents/` и `~/.claude/agents/` отслеживаются на изменения без перезапуска. Перезапуск нужен: при создании первого файла в новой директории; для `--add-dir`; в сессиях с `--disable-slash-commands`",
    confidence: "doc",
  },
  {
    id: "M2",
    section: "3.12",
    statement:
      "`claude plugin validate <dir>` проверяет парсинг frontmatter в указанной директории (v2.1.233+); файлы без `name` не флагует",
    confidence: "doc",
  },
  {
    id: "M3",
    section: "3.12",
    statement: "`/doctor` сообщает о файлах в одной директории с одинаковым `name`",
    confidence: "doc",
  },
  {
    id: "M4",
    section: "3.12",
    statement:
      "`--agent <name>` заменяет системный промпт основной сессии целиком; настройка `agent` в `.claude/settings.json` даёт то же по умолчанию, CLI перекрывает настройку",
    confidence: "doc",
  },
  {
    id: "M5",
    section: "3.12",
    statement:
      "Inline MCP-серверы из файла агента при запуске как main session подключаются на старте наравне с `.mcp.json`",
    confidence: "doc",
  },
  {
    id: "M6",
    section: "3.12",
    statement:
      "Определения агентов доступны agent teams: при спавне teammate применяются его `tools` и `model`, тело добавляется к системному промпту teammate",
    confidence: "doc",
  },
] as const satisfies readonly Fact[];

/** Id of a registered §3 fact. Unregistered ids fail typecheck. */
export type FactId = (typeof FACTS)[number]["id"];

/**
 * Fact id constants, e.g. `FACT.F2`. Call sites reference facts through this
 * object instead of inline string literals so that every reference is checked
 * against the registry.
 */
export const FACT = Object.freeze(
  Object.fromEntries(FACTS.map((fact) => [fact.id, fact.id])),
) as { readonly [K in FactId]: K };

const FACT_BY_ID = new Map<string, Fact>(FACTS.map((fact) => [fact.id, fact]));

export function isFactId(value: string): value is FactId {
  return FACT_BY_ID.has(value);
}

export function getFact(id: FactId): Fact {
  return FACT_BY_ID.get(id)!;
}

/** Trust level of a fact as transcribed from §3. */
export function factConfidence(id: FactId): FactConfidence {
  return getFact(id).confidence;
}

/** @returns every registered fact of the given trust level, in §3 order. */
export function factsByConfidence(confidence: FactConfidence): readonly Fact[] {
  return FACTS.filter((fact) => fact.confidence === confidence);
}

/** [doc] fact IDs referenced by M1 resolver rules. */
export const M1_DOC_FACTS = [
  FACT.F2,
  FACT.F3,
  FACT.F4,
  FACT.F11,
  FACT.T1,
  FACT.T2,
  FACT.T3,
  FACT.P1,
  FACT.P2,
  FACT.P4,
  FACT.P5,
  FACT.N2,
] as const satisfies readonly FactId[];

export type M1DocFactId = (typeof M1_DOC_FACTS)[number];
