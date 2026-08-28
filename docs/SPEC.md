# Claude Agent Configuration Inspector
## Implementation Specification — база для агентной разработки

**Версия документа:** 1.0
**Дата:** 2026-08-28
**Целевая платформа:** Claude Code 2.1.x
**Статус:** готов к реализации; Spike S0 обязателен до начала M1

---

# 0. Как пользоваться этим документом

Документ предназначен для реализации coding-агентом (Claude Code). Он написан как контракт, а не как эссе.

## 0.1. Правила для реализующего агента

Эти правила имеют приоритет над любыми решениями по ходу реализации.

1. **Не угадывать семантику платформы.** Любое утверждение о поведении Claude Code, которого нет в §3 (Verified Platform Facts), должно быть либо проверено и добавлено туда с указанием источника, либо реализовано как `unknown`.
2. **Уверенно неверный ответ — критический дефект.** Честный `unknown` — приемлемый результат. Это правило важнее полноты функциональности.
3. **Каждое нетривиальное правило резолвера ссылается на запись в version matrix (§8) и имеет фикстуру (§11).** Правило без фикстуры не мержится.
4. **Никакой записи в `.claude/**` до milestone M3.** M0–M2 строго read-only. Любой код, который пишет в проект пользователя вне M3, — дефект.
5. **Обычный scan не запускает сторонний код.** Запуск MCP-серверов и runtime-probe — отдельные явные операции с подтверждением.
6. **Не расширять scope.** Всё из §2.3 (Non-goals) не реализуется, даже если кажется простым.
7. **Milestone не завершён**, пока не выполнены все пункты его Acceptance (§10).
8. **Секреты не попадают в логи, кэш, историю, backup и UI.** Значения переменных окружения, токены, заголовки авторизации, содержимое `env` — только имена ключей.

## 0.2. Порядок работ

```
S0 (spike, тайм-бокс 5 дней)  →  M0  →  M1  →  M2  →  M3
```

S0 может идти параллельно с M0, но его результат обязателен до начала M1: он определяет, существует ли слой `observed` (§9).

---

# 1. Тезис продукта

Инструмент отвечает на один вопрос точно и проверяемо:

> **Что конкретный агент реально получает в конкретном режиме запуска, откуда это взялось, и что из этого действительно ограничено, а что — нет?**

Конфигурация Claude Code распределена по пяти и более уровням (managed, CLI, project, user, plugin), зависит от переменных окружения, режима запуска агента (main session / foreground / background / fork), состояния trust и версии CLI. Файлы позволяют всё это настроить, но не позволяют увидеть результат.

Продукт — **configuration intelligence layer**, а не редактор и не runtime.

---

# 2. Границы продукта

## 2.1. Чем является

Локальный read-only инспектор конфигурации Claude Code с опциональным (M3) редактором.

## 2.2. Чем не является

- не AI runtime, не agent loop, не MCP runtime;
- не замена Claude Code;
- не workflow-движок, не оркестратор, не LangGraph/n8n;
- не sandbox и не security boundary.

## 2.3. Non-goals (не реализовывать)

- workflow execution, scenario engine, multi-agent orchestration;
- AI-генерация конфигураций;
- cloud backend, auth, team collaboration, billing, marketplace;
- persistent desired state / profiles (до отдельного требования);
- drag-and-drop редактор графа;
- собственный permission engine.

## 2.4. Язык формулировок

Продукт никогда не утверждает «agent cannot access X» или «sandbox enabled». Допустимо:

```
Claude configuration denies X in this context.
This is not a complete security boundary.
Configuration guardrail.
```

Если у агента есть `Bash`, ограничения на уровне списка инструментов обходятся. Это указывается явно в UI при наличии `Bash`.

---

# 3. Verified Platform Facts

**Опорный слой всего продукта.** Резолвер имеет право опираться только на факты из этого раздела.

Уровни доверия:
- `[doc]` — официальная документация Claude Code (code.claude.com/docs), проверено 2026-08-28;
- `[ext]` — сторонний источник, требует подтверждения фикстурой перед использованием в confident-выводах;
- `[spike]` — не подтверждено, реализовать как `unknown`.

Все факты привязаны к Claude Code 2.1.x. При расхождении с наблюдаемым поведением — §8.4.

## 3.1. Обнаружение агентов

| # | Факт | Доверие |
|---|---|---|
| A1 | Приоритет при совпадении `name`: managed settings > `--agents` CLI > `.claude/agents/` > `~/.claude/agents/` > plugin `agents/` | `[doc]` |
| A2 | Проектные агенты ищутся обходом вверх от cwd; сканируется каждый `.claude/agents/` между cwd и корнем репозитория | `[doc]` |
| A3 | При совпадении `name` во вложенных проектных директориях побеждает ближайшая к cwd (v2.1.178+) | `[doc]` |
| A4 | При совпадении `name` внутри одной директории (включая её подпапки) загружается только один файл; выбор — по порядку чтения ФС, документированного правила нет | `[doc]` |
| A5 | Директории агентов сканируются рекурсивно; идентичность определяется только полем `name`, путь подпапки не влияет | `[doc]` |
| A6 | Для плагинов подпапка входит в scoped id: `agents/review/security.md` в плагине `my-plugin` → `my-plugin:review:security` | `[doc]` |
| A7 | Файл пропускается молча, если: нет `name`; `name` начинается с `-` или содержит `:`; есть `name`, но нет `description`; YAML не парсится. Причина пишется только в debug-лог | `[doc]` |
| A8 | Plugin-агент без `name` или с непарсящимся frontmatter всё равно загружается — под именем файла | `[doc]` |
| A9 | `--add-dir` подключает `.claude/agents/` добавленной директории, но не остальную конфигурацию | `[doc]` |
| A10 | Суммарный размер `description` пользовательских агентов свыше 15 000 токенов вызывает предупреждение при старте Claude Code | `[doc]` |

**Следствие A4:** резолвер обязан помечать такой случай как `ambiguous` и не выбирать победителя.

## 3.2. Frontmatter агента

| # | Факт | Доверие |
|---|---|---|
| F1 | Обязательные поля: `name`, `description`. Опциональные: `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `effort`, `isolation`, `color`, `initialPrompt` | `[doc]` |
| F2 | `disallowedTools` применяется первым, затем `tools` резолвится против остатка. Инструмент в обоих списках удаляется | `[doc]` |
| F3 | Оба поля принимают точные имена инструментов и серверные паттерны `mcp__<server>`, `mcp__<server>__*`. В `disallowedTools` дополнительно работает `mcp__*` (все MCP-инструменты) | `[doc]` |
| F4 | Если ни один элемент `tools` не резолвится в инструмент, субагент не запускается, Agent-инструмент возвращает ошибку (v2.1.208+) | `[doc]` |
| F5 | Синтаксис `Agent(type1, type2)` в `tools` действует только когда агент запущен как main session через `--agent`. Внутри определения субагента список типов в скобках игнорируется | `[doc]` |
| F6 | Отсутствие `Agent` в `tools` полностью лишает агента возможности порождать субагентов | `[doc]` |
| F7 | `model` по умолчанию `inherit`. Порядок разрешения: `CLAUDE_CODE_SUBAGENT_MODEL` → per-invocation параметр → frontmatter → модель основной сессии | `[doc]` |
| F8 | Значения `model` проверяются против организационного allowlist `availableModels`; при блокировке происходит подстановка другой модели | `[doc]` |
| F9 | Для plugin-агентов поля `hooks`, `mcpServers`, `permissionMode` игнорируются | `[doc]` |
| F10 | `initialPrompt` применяется только когда агент запущен как main session (`--agent` или настройка `agent`) | `[doc]` |
| F11 | Инструмент `Task` переименован в `Agent` в v2.1.63; `Task(...)` остаётся рабочим алиасом | `[doc]` |

## 3.3. Фильтры набора инструментов по контексту

| # | Факт | Доверие |
|---|---|---|
| T1 | **Фильтр 1** (все субагенты, даже если инструмент указан в `tools`) удаляет: `Agent` (на пределе глубины), `AskUserQuestion`, `EndConversation`, `EnterPlanMode`, `ExitPlanMode` (кроме `permissionMode: plan`), `ScheduleWakeup`, `TaskOutput`, `WaitForMcpServers`, `Workflow` | `[doc]` |
| T2 | **Фильтр 2** (фоновые субагенты) сохраняет все MCP-инструменты, но из встроенных оставляет только: `Read`, `Grep`, `Glob`, `Bash`, `PowerShell`, `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`, `TodoWrite`, `Skill`, `ToolSearch`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `TaskStop`, `SendMessage`, `Artifact` | `[doc]` |
| T3 | Форк пропускает оба фильтра и получает точный пул инструментов родительской сессии, её системный промпт, модель и историю | `[doc]` |
| T4 | Teammates в agent teams дополнительно сохраняют `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`, `CronCreate`, `CronDelete`, `CronList` | `[doc]` |
| T5 | Одно и то же определение агента резолвится в разный набор инструментов в foreground и background | `[doc]` |
| T6 | Фоновый режим — поведение по умолчанию в интерактивной сессии при включённом fork mode (v2.1.232+) | `[doc]` |

## 3.4. Permission mode

| # | Факт | Доверие |
|---|---|---|
| P1 | Если родитель в `bypassPermissions` или `acceptEdits` — это имеет приоритет и не переопределяется frontmatter'ом субагента | `[doc]` |
| P2 | Если родитель в `auto` — субагент наследует `auto`, а `permissionMode` во frontmatter **игнорируется** | `[doc]` |
| P3 | `auto` — стартовый режим по умолчанию на планах Pro, Max и Team, если настройки или организация не меняют его | `[doc]` |
| P4 | При `permissions.disableBypassPermissionsMode` frontmatter-значение `bypassPermissions` игнорируется (v2.1.223+) | `[doc]` |
| P5 | Режимы: `default` (manual), `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan` | `[doc]` |

**Следствие:** для большинства пользователей поле `permissionMode` в определении агента не действует. UI обязан показывать declared и effective раздельно (§7.4).

## 3.5. Permissions (settings)

| # | Факт | Доверие |
|---|---|---|
| S1 | Приоритет файлов настроек: managed > command line > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json` | `[ext]` |
| S2 | Правила мержатся по всем скоупам; `deny` на любом уровне не переопределяется нигде, включая bypass-режим | `[ext]` |
| S3 | MCP-правила не поддерживают скобочный синтаксис: `mcp__server(pattern)` невалидно. Валидно: `mcp__server`, `mcp__server__tool`, `mcp__server__*` | `[ext]` |
| S4 | В `allow` неякорные глобы (`*`, `mcp__*`) игнорируются и ничего не разрешают | `[ext]` |
| S5 | `deny` на голое имя инструмента (`"Bash"`) полностью убирает инструмент из контекста | `[ext]` |
| S6 | `Bash(cmd:*)` — префиксное сопоставление; `:*` распознаётся только в конце паттерна | `[ext]` |
| S7 | `Read`/`Edit` используют gitignore-подобные глобы; ведущий `/` — корень проекта, `//` — абсолютный путь | `[ext]` |
| S8 | `WebFetch`-правила требуют префикса `domain:` | `[ext]` |
| S9 | Запрет субагентов: `permissions.deny: ["Agent(<name>)"]`, работает для встроенных и пользовательских | `[doc]` |
| S10 | Запрет скиллов: `Skill` (все), `Skill(<name>)` / `Skill(<name> *)` (конкретный) | `[ext]` |
| S11 | `additionalDirectories` расширяет файловый доступ; `enableAllProjectMcpServers` автоодобряет серверы из `.mcp.json` | `[ext]` |

Все `[ext]` здесь обязательны к подтверждению фикстурой до использования в confident-выводах.

## 3.6. Skills

| # | Факт | Доверие |
|---|---|---|
| K1 | `skills:` во frontmatter агента — **преload полного содержимого скилла в контекст**, а не allowlist доступа | `[doc]` |
| K2 | Без `skills:` субагент всё равно обнаруживает и вызывает project/user/plugin-скиллы через инструмент `Skill` (v2.1.133+) | `[doc]` |
| K3 | Полный запрет скиллов для агента — только через отсутствие `Skill` в `tools` или наличие в `disallowedTools`. Нативного per-agent allowlist скиллов не существует | `[doc]` |
| K4 | Нельзя преload'ить скилл с `disable-model-invocation: true` | `[doc]` |
| K5 | Отсутствующий или отключённый скилл в `skills:` пропускается с записью в debug-лог | `[doc]` |
| K6 | `allowed-tools` в SKILL.md — **пре-одобрение** инструментов, а не ограничение. Остальные инструменты остаются вызываемыми, permission-настройки продолжают действовать | `[doc]` |
| K7 | `allowed-tools` проектного скилла применяется при любом вызове скилла, включая `-p` в никогда не доверенной папке | `[doc]` |
| K8 | Глобальные `deny`-правила всегда побеждают `allowed-tools` | `[ext]` |
| K9 | `disallowed-tools` в SKILL.md убирает инструменты из пула на время активности скилла | `[doc]` |
| K10 | Настройка `skillOverrides` позволяет управлять скиллами из settings без правки файла скилла | `[ext]` |
| K11 | `.claude/commands/*.md` продолжает работать; при совпадении имени `.claude/skills/` имеет приоритет | `[ext]` |
| K12 | `--add-dir` подключает `.claude/skills/` добавленной директории (осознанное исключение из A9) | `[ext]` |

**Следствие K6+K7:** проектный скилл, пре-одобряющий `Bash(git *)`, — это audit finding, а не ограничение (§7.6).

## 3.7. Trust

| # | Факт | Доверие |
|---|---|---|
| R1 | Inline-определения MCP-серверов в файле агента из проектного `.claude/agents/` (или из `.claude/agents/` директории `--add-dir`) загружаются только после принятия trust для папки, откуда пришёл файл агента | `[doc]` |
| R2 | Trust родительской папки **не засчитывается**; автоматический trust, который `-p`/SDK-сессия получает для хуков в settings-файлах, тоже не засчитывается | `[doc]` |
| R3 | Без trust Claude Code пропускает inline-серверы и пишет в debug-лог точный ключ `projects["<path>"].hasTrustDialogAccepted` для `~/.claude.json` | `[doc]` |
| R4 | **Без проверки trust** загружаются: ссылка по имени на уже сконфигурированный сервер; inline-сервер из `~/.claude/agents/`; из `--agents`/SDK; из managed settings | `[doc]` |
| R5 | Frontmatter-хуки проектного агента требуют принятого trust для содержащей папки; хуки user-level агентов и `--agents` работают без этого | `[doc]` |
| R6 | Директория, добавленная через `--add-dir` из-за пределов доверенного репозитория, требует отдельной записи trust | `[doc]` |

**Критично:** trust не блокирует конфигурацию проекта целиком. Статус `blocked_by_trust` допустим **только** для R1 и R5. Сервер из `.mcp.json` под это правило не подпадает.

## 3.8. Инструкции (CLAUDE.md)

| # | Факт | Доверие |
|---|---|---|
| I1 | Кастомный субагент получает все уровни иерархии CLAUDE.md, которые грузит основная сессия: `~/.claude/CLAUDE.md`, project rules, `CLAUDE.local.md`, managed policy files | `[doc]` |
| I2 | Explore и Plan **не** загружают CLAUDE.md и git status. Поля frontmatter или настройки для изменения этого не существует | `[doc]` |
| I3 | Селективное назначение инструкций конкретному агенту платформой не поддерживается | `[doc]` |
| I4 | Субагент получает системный промпт из тела своего файла плюс базовые сведения об окружении, а не полный системный промпт Claude Code | `[doc]` |
| I5 | Git status — снимок на момент старта родительской сессии; отсутствует вне git-репозитория и при `includeGitInstructions: false` | `[doc]` |

## 3.9. Встроенные агенты

| # | Факт | Доверие |
|---|---|---|
| B1 | Встроенные: `Explore`, `Plan`, `general-purpose`, `claude`, `statusline-setup`, `claude-code-guide` | `[doc]` |
| B2 | Explore и Plan: только read-only инструменты, `Write` и `Edit` запрещены | `[doc]` |
| B3 | Explore наследует модель основной сессии (v2.1.198+), на Claude API ограничена сверху Opus | `[doc]` |
| B4 | Пользовательский агент с именем `Explore` переопределяет встроенный и сохраняет своё поле `model` | `[doc]` |
| B5 | `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` убирает только Explore и Plan (v2.1.198+) | `[doc]` |
| B6 | `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` убирает все встроенные типы в non-interactive и SDK | `[doc]` |

## 3.10. Вложенность и параллелизм

| # | Факт | Доверие |
|---|---|---|
| N1 | По умолчанию субагент может порождать субагентов до 3 слоёв ниже основной сессии (v2.1.219+) | `[doc]` |
| N2 | На пределе глубины `Agent` изымается у всех, кроме форка; у форка инструмент остаётся в списке, но возвращает ошибку | `[doc]` |
| N3 | `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` меняет предел; `1` отключает вложенность | `[doc]` |
| N4 | Предел одновременных субагентов — 20, меняется через `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (v2.1.217+) | `[doc]` |
| N5 | Исторические значения предела глубины: v2.1.172–2.1.216 — 5 без возможности изменить; v2.1.217–2.1.218 — 1; v2.1.219+ — 3 | `[doc]` |

## 3.11. Переменные окружения, влияющие на резолюцию

| Переменная | Влияние | Доверие |
|---|---|---|
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` | Все субагенты в foreground → применяется только Фильтр 1 | `[doc]` |
| `CLAUDE_CODE_FORK_SUBAGENT` | `1` включает fork mode в non-interactive/SDK, `0` выключает везде | `[doc]` |
| `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | Предел вложенности → доступность `Agent` | `[doc]` |
| `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` | Убирает Explore и Plan | `[doc]` |
| `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` | Убирает все встроенные типы | `[doc]` |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Переопределяет модель субагентов; `inherit` = как не задано (v2.1.196+) | `[doc]` |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | Предел параллельных субагентов | `[doc]` |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | Отключает `memory` во frontmatter | `[doc]` |
| Блок `env` в settings.json | Инжектируется в каждую сессию и вызов инструмента | `[ext]` |

Список version-aware и расширяемый. Значения не логировать и не кэшировать — только имя ключа и нормализованное влияние.

## 3.12. Прочее

| # | Факт | Доверие |
|---|---|---|
| M1 | `.claude/agents/` и `~/.claude/agents/` отслеживаются на изменения без перезапуска. Перезапуск нужен: при создании первого файла в новой директории; для `--add-dir`; в сессиях с `--disable-slash-commands` | `[doc]` |
| M2 | `claude plugin validate <dir>` проверяет парсинг frontmatter в указанной директории (v2.1.233+); файлы без `name` не флагует | `[doc]` |
| M3 | `/doctor` сообщает о файлах в одной директории с одинаковым `name` | `[doc]` |
| M4 | `--agent <name>` заменяет системный промпт основной сессии целиком; настройка `agent` в `.claude/settings.json` даёт то же по умолчанию, CLI перекрывает настройку | `[doc]` |
| M5 | Inline MCP-серверы из файла агента при запуске как main session подключаются на старте наравне с `.mcp.json` | `[doc]` |
| M6 | Определения агентов доступны agent teams: при спавне teammate применяются его `tools` и `model`, тело добавляется к системному промпту teammate | `[doc]` |

---

# 4. Модель контекста исполнения

## 4.1. Принцип

Effective configuration — функция, а не значение:

```
EffectiveConfig = f(
  project snapshot,
  agent,
  platform version,
  environment,
  execution context,
  parent state
)
```

Показывать «Backend Agent → 12 tools» без указания контекста запрещено.

## 4.2. Контекст как набор флагов, а не закрытый union

Перечень режимов будет расти (teammates, resumed subagents, worktree-isolated). Моделируем флагами, чтобы новая семантика была новым флагом, а не новой веткой через весь резолвер.

```typescript
interface ExecutionContext {
  /** Пресет для UI; на резолвер напрямую не влияет */
  preset: ContextPreset;

  /** Агент запущен как основная сессия (--agent / настройка agent) */
  isMainSession: boolean;

  /** Фоновый субагент → применяется Фильтр 2 (T2) */
  isBackground: boolean;

  /** Форк → оба фильтра пропускаются, пул наследуется от родителя (T3) */
  isFork: boolean;

  /** Teammate в agent teams → дополнительные task/cron инструменты (T4) */
  isTeammate: boolean;

  /** Встроенный агент со специальной семантикой */
  builtinKind?: "explore" | "plan" | "general-purpose" | "claude";

  /** Текущая глубина вложенности (0 = основная сессия) */
  depth: number;

  /** Предел вложенности из окружения/настроек */
  maxDepth: number;

  /** Режим родительской сессии — влияет на P1/P2 */
  parentPermissionMode?: PermissionMode;
}

type ContextPreset =
  | "main-session"
  | "foreground-subagent"
  | "background-subagent"
  | "fork"
  | "explore"
  | "plan"
  | "teammate";
```

## 4.3. Пресеты

| Пресет | isMainSession | isBackground | isFork | builtinKind | Комментарий |
|---|---|---|---|---|---|
| `main-session` | true | false | false | — | `--agent`; действуют `Agent(type)` (F5), `initialPrompt` (F10), inline MCP на старте (M5) |
| `foreground-subagent` | false | false | false | — | Фильтр 1 |
| `background-subagent` | false | true | false | — | Фильтр 1 + Фильтр 2. **Дефолт в интерактивной сессии** |
| `fork` | false | true | true | — | Оба фильтра пропущены; frontmatter агента не применяется |
| `explore` | false | — | false | explore | Read-only, без CLAUDE.md (I2) |
| `plan` | false | — | false | plan | Read-only, без CLAUDE.md (I2) |
| `teammate` | false | false | false | — | Фильтр 1 + task/cron (T4) |

Дефолт в UI — `background-subagent`, потому что это фактический режим по умолчанию (T6). Рядом обязательна подпись, почему выбран именно он.

## 4.4. Правила резолвера по контексту

1. Если `isFork` — конфигурация агента (`tools`, `disallowedTools`, `mcpServers`, `model`, `permissionMode`) **не применяется**; вернуть пул родителя с reason `context-filter` и enforcement `unknown` (T3).
2. Если `depth >= maxDepth` — `Agent` недоступен, reason `depth-limit` (N2).
3. Если `isBackground` — применить Фильтр 2 после Фильтра 1 (T2).
4. Если задан `builtinKind` — инструкции резолвятся как 0 источников с reason по I2; `Write`/`Edit` denied (B2).
5. Если `parentPermissionMode ∈ {bypassPermissions, acceptEdits, auto}` — declared `permissionMode` агента помечается как ineffective (P1, P2).
6. `disallowedTools` применяется до `tools` (F2).
7. Правила `permissions.deny` из настроек применяются последними и не переопределяются ничем (S2).

---

# 5. Доменная модель

```typescript
type Scope =
  | "managed" | "cli" | "project" | "user"
  | "plugin" | "local" | "nested-project" | "unknown";

interface SourceInfo {
  platform: "claude";
  path?: string;
  scope: Scope;
  /** Точное поле-источник, напр. "frontmatter.disallowedTools[0]" */
  fieldPath?: string;
  /** id записи version matrix, обосновавшей вывод */
  matrixRef?: string;
}

interface PlatformVersion {
  platform: "claude";
  version: string;          // из `claude --version`
  raw: string;
  detectedAt: string;
}

interface PlatformEnvironment {
  /** Только имена ключей и нормализованное влияние — без значений-секретов */
  relevant: Array<{
    key: string;
    origin: "process" | "settings.env" | "managed";
    effect: string;
    normalizedValue?: string;   // только для известных безопасных флагов
  }>;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  source: SourceInfo;
  status: "active" | "shadowed" | "ambiguous" | "invalid" | "unknown";
  /** Для status = shadowed | ambiguous */
  collision?: {
    candidates: SourceInfo[];
    effective?: SourceInfo;     // отсутствует при ambiguous (A4)
    rule: string;               // matrixRef правила, определившего победителя
  };
  invalidReason?: "no-name" | "no-description" | "bad-yaml" | "bad-name-chars";
  configuration: AgentConfiguration;
  isPluginAgent: boolean;
}

interface AgentConfiguration {
  tools?: string[];
  disallowedTools?: string[];
  mcpServers?: Array<string | InlineMcpServer>;
  model?: string;
  permissionMode?: PermissionMode;
  maxTurns?: number;
  skills?: string[];
  hooks?: unknown;
  memory?: "user" | "project" | "local";
  background?: boolean;
  effort?: string;
  isolation?: "worktree";
  initialPrompt?: string;
  color?: string;
  /** Поля, не распознанные текущей version matrix */
  unknownFields: Record<string, unknown>;
}

interface Tool {
  id: string;                   // "Read" | "mcp__github__create_pr"
  name: string;
  origin: "builtin" | "mcp" | "plugin" | "unknown";
  serverId?: string;
  aliases?: string[];           // напр. Agent ← Task (F11)
}

interface McpServer {
  id: string;
  source: SourceInfo;
  transport: "stdio" | "http" | "sse" | "ws" | "unknown";
  definitionKind: "inline-agent" | "named-reference" | "config-file";
  status:
    | "configured" | "probed" | "unavailable"
    | "requires_auth" | "blocked_by_trust" | "unknown";
  /** Хэш конфигурации — для инвалидации кэша probe */
  configHash: string;
}

interface Skill {
  id: string;
  name: string;
  description?: string;
  source: SourceInfo;
  path: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  /** Пре-одобряемые инструменты (K6) — НЕ ограничение */
  preApprovedTools?: string[];
  disallowedTools?: string[];
  paths?: string[];
  contextFork?: boolean;
  preloadable: boolean;         // false при disableModelInvocation (K4)
}

interface InstructionSource {
  id: string;
  type: "CLAUDE.md" | "CLAUDE.local.md" | "managed" | "imported" | "other";
  path: string;
  scope: Scope;
  contentHash: string;
  sizeBytes: number;
}

interface ResolutionReason {
  type:
    | "declared" | "inherited" | "denied" | "shadowed" | "ambiguous"
    | "trust" | "parent-mode" | "depth-limit" | "context-filter"
    | "version" | "environment" | "plugin-limitation" | "not-probed"
    | "unknown";
  message: string;
  source?: SourceInfo;
  matrixRef?: string;
}

interface ResolvedCapability {
  capabilityId: string;
  kind: "tool" | "mcp_server" | "mcp_tool" | "skill" | "instruction" | "permission";
  status: "available" | "denied" | "preloaded" | "blocked" | "unknown";
  enforcement: "enforced" | "advisory" | "unknown";
  sources: SourceInfo[];
  reasons: ResolutionReason[];
}

interface EffectiveConfiguration {
  agentId: string;
  context: ExecutionContext;
  version: PlatformVersion;
  capabilities: ResolvedCapability[];
  warnings: Warning[];
  /** Доля утверждений со статусом unknown — показывается пользователю */
  unknownRate: number;
}

interface Warning {
  category:
    | "trust" | "shadowing" | "ambiguous-collision" | "unsupported"
    | "ignored-field" | "advisory" | "unknown" | "security-finding"
    | "environment" | "version" | "budget" | "resolver-discrepancy";
  severity: "info" | "warning" | "critical";
  message: string;
  evidence: SourceInfo[];
  matrixRef?: string;
}

interface ProjectSnapshot {
  id: string;                  // хэш содержимого — база для concurrent-modification
  projectPath: string;
  version: PlatformVersion;
  environment: PlatformEnvironment;
  trust: TrustState;
  agents: Agent[];
  skills: Skill[];
  instructions: InstructionSource[];
  mcpServers: McpServer[];
  settings: SettingsLayer[];
  scannedAt: string;
}
```

---

# 6. Классификация enforcement

Каждое утверждение продукта обязано иметь один из трёх статусов.

| Статус | Значение | Примеры |
|---|---|---|
| `enforced` | Платформа гарантированно применяет ограничение | `disallowedTools` агента (F2, F3); `permissions.deny` (S2); Фильтр 1 и 2 (T1, T2) |
| `advisory` | Влияет на поведение, но не является границей | текст CLAUDE.md; тело системного промпта агента; `description` |
| `unknown` | Не подтверждено фикстурой/наблюдением, либо данных нет | MCP-инструменты без probe; коллизия A4; поля вне version matrix; всё в контексте `fork` |

Отдельная категория для UI — **pre-approval**: `allowed-tools` скилла (K6). Никогда не отображать как ограничение; отображать как расширение прав, а при чувствительных инструментах — как security finding.

При наличии у агента `Bash` к любому выводу о наборе инструментов прикладывается:

```
⚠ Agent has Bash access. Tool-level restrictions are a guardrail,
  not a complete security boundary.
```

---

# 7. Функциональные требования

## 7.1. Discovery (read-only)

```
detect claude → version → environment → trust state
  → settings layers → agents → skills → instructions
  → MCP configuration → load probe cache → resolve
```

Требования:
- обход вверх от cwd для проектных скоупов (A2);
- рекурсивный скан директорий агентов и скиллов (A5);
- регистрация невалидных файлов с причиной (A7) — Claude Code о них молчит, это одна из главных ценностей продукта;
- регистрация коллизий (A3, A4);
- учёт `--add-dir`, если он использовался (A9, K12);
- обычный scan **не запускает** MCP-серверы и **не пишет** в проект.

## 7.2. Trust

Читать `~/.claude.json` → `projects["<abs-path>"].hasTrustDialogAccepted`.

Статус `blocked_by_trust` применять **только** к:
- inline-определениям MCP-серверов во frontmatter агента из проектного `.claude/agents/` (R1);
- frontmatter-хукам проектных агентов (R5).

Не применять к серверам из `.mcp.json`, к ссылкам по имени, к агентам из `~/.claude/agents/` (R4). Trust родительской папки не засчитывать (R2).

## 7.3. Effective resolution

Вход: `ProjectSnapshot` + `agentId` + `ExecutionContext`. Выход: `EffectiveConfiguration`.

Каждый `ResolvedCapability` обязан иметь ≥1 `source` и ≥1 `reason`. Capability без reason — дефект.

Порядок применения — §4.4.

## 7.4. Declared vs Effective

Везде, где declared-значение может не действовать, показывать оба:

```
permissionMode
  Declared:  acceptEdits      (.claude/agents/backend.md)
  Effective: auto
  ⚠ Declared value is not effective in this context.
     Parent session permission mode takes precedence. [P2]
```

Обязательно для: `permissionMode`, `model` (F8), полей plugin-агентов (F9), всей конфигурации в контексте `fork` (T3).

## 7.5. Why-панель

```
mcp__github__merge_pr

STATUS        ⊘ Denied
CONTEXT       Background subagent (depth 1)
ENFORCEMENT   ✓ Enforced  [F2, F3]

SOURCE OF CAPABILITY
  github MCP server — .mcp.json

DENIED BY
  .claude/agents/backend.md
  frontmatter.disallowedTools[0]: mcp__github__merge_pr

CHAIN
  1. Tool pool inherited from parent session
  2. disallowedTools applied first             [F2]
  3. tools resolved against remainder          [F2]
  4. Background filter applied                 [T2]
  5. settings permissions.deny — no match      [S2]

EVIDENCE   matrix://agent.disallowedTools@2.1.x
```

## 7.6. Security findings

Отдельная категория warning'ов, не блокирующая, но заметная:

- скилл пре-одобряет чувствительные инструменты (K6, K7) — с указанием паттерна и файла;
- у агента есть `Bash` при формально ограниченном наборе инструментов;
- `permissionMode: bypassPermissions` в определении агента;
- inline MCP-сервер, запускающий произвольную команду;
- `permissions.allow` содержит неякорный глоб, который не работает (S4) — ложное чувство безопасности.

## 7.7. Бюджет описаний

Считать суммарный размер `description` пользовательских агентов и вклад каждого. Порог — 15 000 токенов (A10). Конкретная чинибельная находка.

## 7.8. Managed simulation (дифференциатор, M2)

Взять реальный `ProjectSnapshot`, наложить кандидатный managed-бандл (директория с `settings.json` и `agents/`), показать дельту effective configuration.

```bash
agent-manager simulate --managed ./policy-candidate/
```

Вывод: какие агенты станут shadowed, какие инструменты будут denied, какие поля игнорируются, какие модели заменятся по `availableModels` (F8).

Полностью read-only. Целевой пользователь — платформенная команда, раскатывающая политики на десятки репозиториев.

## 7.9. MCP probe

Явная операция с подтверждением. Обычный scan не выполняет.

```
This starts the MCP server "<id>" and runs its initialization logic.
Command: <command> <args>
Continue?
```

Кэш: `.agent-manager/cache/mcp/<serverId>.json` — `serverId`, `configHash`, `probedAt`, `claudeVersion`, `status`, `tools[] {name, description}`. При изменении `configHash` кэш невалиден. Секреты, токены, заголовки, переменные окружения сервера не сохранять.

## 7.10. Граф (M2, низкий приоритет)

Только инспекция. Рёбра: `Agent → Tool`, `Agent → MCP Server`, `MCP Server → MCP Tool`, `Agent → Skill`, `Agent → Instruction Source`, `Agent → Agent`. Граф context-aware: при смене контекста рёбра пересчитываются. Рёбра не являются workflow.

---

# 8. Version matrix

## 8.1. Модель

```typescript
interface FeatureCompatibility {
  /** Стабильный id, на который ссылается matrixRef */
  id: string;                  // "agent.disallowedTools"
  feature: string;
  factRefs: string[];          // ["F2", "F3"] — ссылки на §3
  minVersion?: string;
  changedIn?: string[];
  observedIn?: string[];       // версии, где подтверждено фикстурой/probe
  status: "supported" | "unsupported" | "changed" | "unknown";
  confidence: "doc" | "fixture" | "runtime-observed";
  fixture?: string;
  notes?: string;
}
```

## 8.2. Правила

- Все version-проверки живут только в `src/adapters/claude/version/`. Проверки версии, разбросанные по коду, — дефект.
- Фича без записи в матрице резолвится как `unknown`.
- `confidence: "doc"` разрешает вывод и допускает `enforcement: enforced` только для фактов уровня `[doc]` из §3. Факты `[ext]` требуют `confidence >= "fixture"`.
- Неизвестные поля frontmatter собираются в `unknownFields` и показываются как `⚠ Unrecognized field — behavior unknown`.

## 8.3. Определение версии

```bash
claude --version
```

Если CLI недоступен — деградированный режим: discovery работает, все version-sensitive выводы становятся `unknown`. Не выводить версию из содержимого файлов.

## 8.4. Расхождение

1. зафиксировать фикстуру, воспроизводящую расхождение;
2. добавить/обновить запись матрицы со `status: "changed"` и `observedIn`;
3. понизить вывод до `unknown`, пока поведение не определено однозначно;
4. **не подгонять резолвер под догадку.**

---

# 9. Runtime observation (Spike S0)

## 9.1. Цель

```
DECLARED  — что написано в конфигурации
RESOLVED  — что предсказывает наш резолвер
OBSERVED  — что реально увидели в рантайме
```

`resolved != observed` — критический дефект адаптера.

## 9.2. Тайм-бокс и порядок попыток

**5 рабочих дней. По истечении — решение по факту, продление запрещено.**

1. **Agent SDK** — программная поверхность, наиболее вероятно даёт структурный доступ к составу инструментов агента. Основной кандидат.
2. **`SubagentStart` hook** — получает `agent_type`; проверить остальной входной JSON.
3. **`PreToolUse` hook** — логирует фактические вызовы инструментов.
4. **`claude -p --debug`** — парсинг отладочного вывода. Не является контрактом, сломается на следующем релизе. Только последним и только с `confidence: low`.

## 9.3. Фундаментальное ограничение

**Наблюдение односторонее.** Хук `PreToolUse` фиксирует только вызванные инструменты. Отсутствие вызова ≠ запрет.

Обязательные следствия:

- `observedStatus: "available"` — валидное наблюдение (инструмент вызван);
- `observedStatus: "not-observed"` — **не доказательство запрета**; никогда не преобразовывать в `denied`;
- `observedStatus: "denied"` требует, чтобы агент попытался вызвать инструмент и получил отказ. Это активный харнесс, а не пассивный наблюдатель, и он недетерминирован. В v0.1 не реализовывать.

```typescript
interface ObservedCapability {
  capabilityId: string;
  context: ExecutionContext;
  observedStatus: "available" | "denied" | "not-observed";
  /** Односторонность: absence НЕ означает denied */
  evidenceKind: "tool-invoked" | "permission-denied" | "absence";
  source: "agent-sdk" | "hook" | "debug-log";
  confidence: "high" | "medium" | "low";
  claudeVersion: string;
  timestamp: string;
}
```

## 9.4. Безопасность probe

- только на фикстурных проектах;
- только в явном developer/test режиме;
- никогда автоматически на проекте пользователя;
- таймаут и изоляция процесса;
- не запускает сторонние MCP-серверы без отдельного подтверждения;
- все результаты помечаются как observation, а не как факт конфигурации.

## 9.5. Fallback при провале спайка

- §9 и `ObservedCapability` исключаются из v0.1;
- источники evidence ограничиваются `documentation | fixture | code-inspection`;
- correctness gate (§11.3) опирается только на фикстуры;
- максимальный `confidence` в матрице становится `"fixture"`;
- в Acceptance M1 пункты про runtime observation заменяются на coverage-by-documentation.

Fallback — штатный исход, а не провал проекта.

---

# 10. Milestones

## M0 — Discovery Viewer (2–3 дня)

**Цель:** первый экран, который можно открыть на чужом репозитории и получить пользу. Резолвера нет.

Реализовать: определение проекта и версии; обход скоупов; список агентов с source и scope; shadowed/ambiguous/invalid с причиной; declared frontmatter as-is; списки скиллов, инструкций, MCP-серверов из конфигурации; CLI `scan` и `status`.

**Acceptance M0**
1. Открывается существующий Claude-проект, ни один файл не изменён.
2. Показана версия Claude Code или явное «не определена».
3. Перечислены все агенты из всех скоупов с указанием файла.
4. Невалидные файлы показаны с конкретной причиной (A7).
5. Коллизии имён показаны; случай A4 помечен `ambiguous`, победитель не выбран.
6. `--add-dir`-директории учтены, если использовались.
7. Ни одного сетевого запроса и ни одного запуска стороннего процесса, кроме `claude --version`.

## M1 — Resolver + Explainability

**Цель:** ядро продукта.

Реализовать: `ExecutionContext` по флагам (§4.2); селектор контекста; резолвер по §4.4; enforcement-классификацию; declared vs effective; trust; окружение; Why-панель; warnings; version matrix; фикстуры и correctness gate.

**Acceptance M1**
1. Каждая capability имеет ≥1 source и ≥1 reason.
2. Смена контекста меняет результат; foreground / background / fork / explore различаются.
3. `fork` не применяет конфигурацию агента и явно объясняет почему (T3).
4. Declared и effective `permissionMode` показаны раздельно; при родительском `auto` declared помечен как игнорируемый (P2).
5. Explore/Plan показывают 0 источников инструкций с объяснением (I2).
6. Поля plugin-агентов `hooks`/`mcpServers`/`permissionMode` помечены как неэффективные (F9).
7. `blocked_by_trust` выставляется только в случаях R1 и R5; сервер из `.mcp.json` не помечается.
8. Предел глубины влияет на доступность `Agent` (N2).
9. Все `[ext]`-факты, использованные в confident-выводах, имеют фикстуру.
10. Ни одно confident-утверждение не расходится с корпусом фикстур.
11. `unknownRate` показывается пользователю по его проекту.

## M2 — Probe, Graph, Managed Simulation

Реализовать: MCP probe (§7.9); граф (§7.10); managed simulation (§7.8); security findings (§7.6); бюджет описаний (§7.7).

**Acceptance M2**
1. Probe не выполняется без явного подтверждения; команда сервера показана до запуска.
2. Кэш инвалидируется при изменении `configHash`.
3. Ни один секрет не попал в кэш, лог или UI.
4. Simulation не пишет ни в проект, ни в managed-бандл, и показывает дельту по агентам, инструментам и моделям.
5. Граф пересчитывается при смене контекста.

## M3 — Editor (v0.2)

Реализовать: редактор агента; desired state **только в памяти**; детерминированный diff; проверку конкурентной модификации по `ProjectSnapshot.id`; backup; apply; apply confirmation; rollback.

**Acceptance M3**
1. Клик по чекбоксу не пишет в файл; изменения попадают в pending.
2. Diff показывает точный набор файлов и полей; изменений вне плана нет.
3. Если `ProjectSnapshot.id` изменился с начала редактирования — предупреждение и выбор действия; автоматической перезаписи нет.
4. Backup создаётся до любой мутации и содержит версию Claude, хэш снимка, оригиналы файлов.
5. После apply показывается «Configuration written. Runtime behavior has not been independently verified» — если слоя observation нет.
6. Слово «verified» не используется без наблюдения.
7. Rollback восстанавливает файлы из backup и подтверждается повторным чтением.
8. Ручное изменение `.claude/**` не называется drift: `.claude/**` — источник истины.
9. Persistent desired state отсутствует.

---

# 11. Корректность

## 11.1. Фикстуры

```
tests/fixtures/claude/
├── basic/                  агент, скилл, .mcp.json
├── nested-project/         A2, A3
├── collision-nested/       A3 — победитель определён
├── collision-same-dir/     A4 — ambiguous, победителя нет
├── invalid-agents/         A7, все четыре причины
├── plugin-agents/          F9, A6, A8
├── tools-filters/          F2, F3, F4
├── background/             T2
├── fork/                   T3
├── depth-limit/            N1, N2, N3
├── permission-inheritance/ P1, P2, P4
├── settings-permissions/   S1–S8
├── skills-preload/         K1, K2, K3, K4
├── skill-allowed-tools/    K6, K7 — security finding
├── trust-inline-mcp/       R1, R4 — включая негативный кейс
├── instructions/           I1, I2
├── environment/            §3.11
├── add-dir/                A9, K12
├── version-drift/          §8.4
└── managed-simulation/     §7.8
```

## 11.2. Контракт фикстуры

```
fixture/
├── project/           файловая структура
├── env.json           переменные окружения
├── version.txt        версия Claude Code
├── contexts.json      контексты, для которых считается ожидание
└── expected.json      discovery + resolution + reasons + warnings
```

`expected.json` — golden-файл. Сравнение детерминированное; порядок сущностей нормализуется перед сравнением.

## 11.3. Correctness gate

Единственный блокирующий критерий:

> **Ни одно confident-утверждение резолвера не расходится с золотым ожиданием или с runtime-наблюдением.**

`unknown` в ответе — не нарушение. Уверенный неверный ответ — блокирует релиз.

## 11.4. Coverage (не accuracy)

Не считать «процент точности»: знаменатель управляем самим резолвером, и метрика поощряет молчание. Считать покрытие с фиксированным знаменателем по списку фактов §3:

```
runtime-observed    : N
fixture-verified    : M
documentation-only  : K
unverified          : L
```

Монотонная и честная метрика зрелости адаптера. Живёт в CI-отчёте.

**В UI пользователю показывать другое число** — долю `unknown` в резолюции **его** конфигурации (`EffectiveConfiguration.unknownRate`). Метрику тест-сьюта в продуктовый UI не выносить.

---

# 12. Технические решения

## 12.1. Stack

| Слой | Выбор |
|---|---|
| Frontend | React + TypeScript + Vite |
| Граф | React Flow — только M2, только инспекция |
| Backend | Node.js + TypeScript, локальный сервер |
| CLI | Node.js + TypeScript (Commander) |
| Хранилище | Файловая система, JSON. Базы данных нет |
| Тесты | Vitest + golden-файлы |

## 12.2. Структура

```
src/
├── core/                    платформенно-независимое
│   ├── model/
│   ├── resolver/            движок применения фильтров по флагам
│   ├── graph/
│   └── warnings/
│
├── adapters/claude/         вся Claude-специфика
│   ├── adapter.ts
│   ├── version/             matrix.ts, facts.ts
│   ├── environment/
│   ├── discovery/           agents, skills, instructions, mcp, settings, trust
│   ├── parsing/
│   ├── resolution/          правила §4.4
│   ├── probing/             mcp probe, runtime probe (S0)
│   └── generation/          только M3
│
├── application/             scan, inspect, explain, simulate, plan, apply
├── server/                  routes, services
├── cli/
└── ui/                      pages, inspectors, why-panel, graph, state
```

**Инвариант:** `src/core/` не содержит ни одного пути вида `.claude/`, ни одного имени поля frontmatter, ни одной проверки версии.

## 12.3. Локальное состояние

```
.agent-manager/
└── cache/
    └── mcp/            результаты probe, инвалидируются по configHash
```

M0–M2: только `cache/`. `history/` и `backups/` появляются в M3 вместе с write-path. Рекомендовать `.agent-manager/` в `.gitignore` — данные машинно-специфичны.

## 12.4. API

```http
# M0
POST /api/project/scan
GET  /api/project
GET  /api/agents

# M1
GET  /api/agents/:id
GET  /api/agents/:id/effective?context=<preset>&depth=&parentMode=
GET  /api/capabilities/:id/explain?agent=&context=
GET  /api/warnings

# M2
POST /api/mcp/:id/probe
GET  /api/graph?context=<preset>
POST /api/simulate/managed

# M3
POST /api/plan
POST /api/apply
POST /api/rollback/:operationId
GET  /api/history
```

## 12.5. CLI

```bash
agent-manager scan [path]
agent-manager status
agent-manager agents
agent-manager explain <capability> --agent <id> --context <preset>
agent-manager warnings
agent-manager probe-mcp <server>
agent-manager simulate --managed <dir>
agent-manager observe --fixture <name>      # только S0 / dev

# M3
agent-manager diff
agent-manager apply
agent-manager rollback <operationId>
```

## 12.6. Логирование

Логировать: id операции, версию Claude, id фичи из матрицы, путь-источник, результат, тайминг.
Не логировать: токены, пароли, заголовки авторизации, значения переменных окружения, конфигурацию MCP с credentials.

---

# 13. Инварианты

Нарушение любого — дефект, блокирующий мерж.

1. Claude-специфика существует только в `src/adapters/claude/`.
2. Резолвер детерминирован: одинаковый вход → одинаковый выход, включая порядок.
3. Каждое утверждение имеет source, reason и enforcement.
4. `unknown` никогда не превращается в `allow` или `deny`.
5. `not-observed` никогда не превращается в `denied`.
6. Никакой записи в `.claude/**` вне M3 и вне явного Apply.
7. Backup до любой мутации.
8. Обычный scan не выполняет сторонний код.
9. MCP probe и runtime probe — только по явному действию с подтверждением.
10. Секреты не попадают в логи, кэш, историю, backup и UI.
11. Version-проверки только через матрицу.
12. Продукт не обещает security-гарантий, которых платформа не даёт.
13. Метрика тест-сьюта не отображается как свойство проекта пользователя.
14. Уверенно неверный ответ хуже любой недостающей функции.

---

# 14. Приоритеты

```
1. Semantic correctness
2. Honest unknowns
3. Explainability
4. Context-aware resolution
5. Runtime evidence (если S0 удался)
6. Safe inspection
7. Только потом — редактирование
8. Только после этого — что-либо визуально-workflow-подобное
```

Продукт всегда предпочитает «I don't know» ответу «I know», который неверен. Именно это отличает configuration intelligence layer от красивого UI поверх `.claude/`.
