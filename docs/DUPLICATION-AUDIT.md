# Аудит дублирования кода Capsight

**Дата:** 2026-09-01  
**Статус:** рефакторинг фаз 1–5 выполнен (см. ниже)  
**Метод:** 4 параллельных explore-агента + перекрёстная проверка через grep

---

## 1. Методология

| Агент | Область | Находок |
|-------|---------|---------|
| Claude adapter | `src/adapters/claude/` | 27 |
| Core / App / CLI / Server / UI | всё кроме claude adapter | 37 |
| Tests | `tests/` | 12 кластеров |
| Cross-cutting | сквозные паттерны | 9 приоритетных |

### Перекрёстная проверка (grep)

| Паттерн | Копий (до рефакторинга) | Подтверждено |
|---------|-------------------------|--------------|
| `compareStrings` | 10+ (8 prod + 2 test) | да |
| `makeReason` | 8+ | да |
| `isDirectory` | 12+ | да |
| `readJsonFile` | 4 | да |
| `withMatrixPatch` | 6 test-файлов | да |
| `formatSourceLine` | 3 UI-компонента | да |
| `collectMarkdownFiles` | 6 | да |
| `parseSemver` | 7 (3× detect + 3× matrix + core compat) | да |
| `AgentNotFoundError` / `computeUnknownRate` | по 3 адаптера | да |
| `computeSnapshotId` | 3 адаптера | да |
| Cursor/Codex `frontmatter.ts` | идентичное начало | да (чтение файлов) |

### Уточнения после кросс-чека

- `buildConfiguration` + `KNOWN_FRONTMATTER_KEYS` — **точный** дубль только в `claude/agents.ts` ↔ `claude/managed-overlay.ts`; в `cursor/agents.ts` — near-duplicate с типом `CursorAgentConfiguration`.
- `infer-mcp-transport` уже в `src/adapters/shared/infer-mcp-transport.ts`, но Claude adapter его **не использовал** (3 локальные копии `inferTransport`) — исправляется в Phase 3.
- `src/shared/` не существует; shared-модули адаптеров живут в `src/adapters/shared/`.

### Категории находок

| Категория | Описание |
|-----------|----------|
| `explicit_duplicate` | Байт-в-байт или функционально идентично |
| `near_duplicate` | Тот же алгоритм; отличаются типы, константы, транспорт ошибок |
| `extract_candidate` | Повторяющийся паттерн; вынос оправдан |

### Инварианты (не нарушать при рефакторинге)

- Platform path segments (`.claude`, `.cursor`, `.codex`) — **не** в `src/core/`; только `src/adapters/*/discovery/paths.ts` или `src/adapters/shared/`.
- Claude-specific логика — только в `src/adapters/claude/`.
- Version checks Claude — только через `src/adapters/claude/version/`.
- Каждое изменение resolver rule — matrix entry + fixture (SPEC §0.1 #3).
- Ordinary scan не запускает сторонний код.

---

## 2. Сводная таблица

| ID | Категория | Confidence | Паттерн | Целевой модуль | Фаза |
|----|-----------|------------|---------|----------------|------|
| D-01 | explicit_duplicate | high | `compareStrings` | `src/core/sort/compare-strings.ts` | 1 |
| D-02 | explicit_duplicate | high | `isDirectory` / `pathExists` / `fileExists` | `src/adapters/shared/fs.ts` | 1 |
| D-03 | explicit_duplicate | high | `readJsonFile` | `src/adapters/shared/fs.ts` | 1 |
| D-04 | explicit_duplicate | high | `parseFrontmatter` (cursor ≡ codex) | `src/adapters/shared/frontmatter.ts` | 2 |
| D-05 | explicit_duplicate | high | `redactUnknownFields` (cursor ≡ codex) | `src/adapters/shared/redact.ts` | 2 |
| D-06 | explicit_duplicate | high | `parseSemver` + `compareSemver` | `src/core/version/semver.ts` | 1 |
| D-07 | near_duplicate | high | `version/detect.ts` (3 адаптера) | `src/adapters/shared/cli-version-detect.ts` | 2 |
| D-08 | explicit_duplicate | high | `withMatrixPatch` (tests) | `tests/helpers/matrix-patch.ts` | 5 |
| D-09 | extract_candidate | high | Golden fixture runner pipeline | `tests/fixtures/platform-golden-runner.ts` | 5 |
| D-10 | explicit_duplicate | high | `collectMarkdownFiles` (claude) | `src/adapters/claude/io/collect-markdown.ts` | 3 |
| D-11 | explicit_duplicate | high | `buildConfiguration` + `KNOWN_FRONTMATTER_KEYS` | `src/adapters/claude/parsing/agent-configuration.ts` | 3 |
| D-12 | near_duplicate | medium | Agent collision resolution | `src/adapters/claude/discovery/agent-collisions.ts` | 3 |
| D-13 | extract_candidate | medium | `agentId` / `SCOPE_PRIORITY` / `shortHash` | `src/adapters/claude/discovery/ids.ts` | 3 |
| D-14 | near_duplicate | high | `makeReason` | `src/core/resolver/reasons.ts` | 1/3 |
| D-15 | near_duplicate | high | MCP `inferTransport`, `sortedKeys`, config parse | `infer-mcp-transport.ts` + `mcp-hash.ts` | 2/3 |
| D-16 | near_duplicate | high | Два `parseSemver` внутри Claude | `src/adapters/claude/version/semver.ts` | 3 |
| D-17 | near_duplicate | high | `adapter.ts` scan/resolve shell | `src/adapters/shared/create-adapter.ts` | 2 |
| D-18 | explicit_duplicate | high | `computeSnapshotId` | `src/adapters/shared/snapshot-id.ts` | 2 |
| D-19 | explicit_duplicate | high | Resolver helpers + `AgentNotFoundError` | `src/core/resolver/` + `adapters/shared/errors.ts` | 2 |
| D-20 | near_duplicate | medium | `discoverFromSkillsDir` / skill parsing | `src/adapters/shared/discover-skills.ts` | 2 |
| D-21 | explicit_duplicate | high | `environment/index.ts` stub (cursor ≡ codex) | `src/adapters/shared/empty-environment.ts` | 2 |
| D-22 | near_duplicate | high | `detect-platforms.ts` fs-walk + paths | `adapters/shared/fs.ts` + per-platform `paths.ts` | 1/2 |
| D-23 | near_duplicate | high | CLI ↔ Server validation | `src/application/context-resolution.ts` | 4 |
| D-24 | near_duplicate | high | `requireLastScan` vs inline guards | `src/server/helpers/require-scan.ts` | 4 |
| D-25 | explicit_duplicate | high | UI `formatSourceLine`, `agentPath` | `src/ui/format/` | 4 |
| D-26 | near_duplicate | high | Scan-store test factories | `tests/helpers/claude-scan-fixtures.ts` | 5 |
| D-27 | near_duplicate | high | Temp dir lifecycle | `tests/helpers/temp-dir.ts` | 5 |
| D-28 | near_duplicate | high | UI model factories | `tests/helpers/model-fixtures.ts` | 5 |
| D-29 | explicit_duplicate | high | Ecosystem test factories | `tests/helpers/ecosystem-fixtures.ts` | 5 |
| D-30 | near_duplicate | high | Git temp project builders | `tests/helpers/git-temp-project.ts` | 5 |

---

## 3. Детальные находки

### Tier 1 — Foundation (D-01…D-09)

#### D-01: `compareStrings`

**Файлы:** `src/application/plan.ts`, `simulate.ts`; `src/adapters/claude/generation/{plan,apply,rollback}.ts`; `src/adapters/claude/resolution/resolver.ts`; `src/adapters/claude/discovery/managed-overlay.ts`; `tests/fixtures/golden-normalize.ts`; `tests/fixtures/ecosystem-golden-normalize.ts`

```typescript
function compareStrings(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
```

Locale-independent сортировка для детерминизма golden fixtures.

#### D-02: Filesystem helpers

**Файлы:** 12+ — `claude/discovery/{project-walk,agents,skills,plugins,managed-overlay}.ts`, `cursor/discovery/{project-walk,skills}.ts`, `codex/discovery/project-walk.ts`, `application/detect-platforms.ts`

```typescript
async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
```

#### D-03: `readJsonFile`

**Файлы:** `claude/discovery/mcp.ts`, `claude/probing/mcp-probe.ts`, `cursor/discovery/mcp.ts`

#### D-04: Frontmatter parser

**Файлы:** `cursor/parsing/frontmatter.ts` ≡ `codex/parsing/frontmatter.ts`; частичный дубль в `application/resource-content.ts`

#### D-05: Redaction helpers

**Файлы:** `cursor/discovery/redact.ts` ≡ `codex/discovery/redact.ts`

#### D-06: Semver comparison

**Файлы:** `core/compat/matrix.ts`, `adapters/{claude,cursor,codex}/version/matrix.ts`

#### D-07: CLI version detection

**Файлы:** `adapters/{claude,cursor,codex}/version/detect.ts` — отличаются только command string и platform constant.

#### D-08–D-09: Test infrastructure

**Файлы:** 6× `withMatrixPatch`; 5× golden runner pipeline (`run-golden.test.ts`, `run-codex-golden.test.ts`, `run-cursor-golden.test.ts`, `correctness-gate.test.ts`, `matrix.test.ts`)

---

### Tier 2 — Claude adapter internal (D-10…D-16)

#### D-10–D-11: Agents ↔ managed-overlay

`collectMarkdownFiles`, `buildConfiguration`, `KNOWN_FRONTMATTER_KEYS` — идентичны в `agents.ts` и `managed-overlay.ts`.

#### D-12: Collision resolution

`resolveCollisions` (agents.ts) vs `reconcileAgentCollisions` (managed-overlay.ts) — тот же A4/A1/A3 алгоритм.

#### D-15: MCP transport (неполная унификация)

Claude `mcp.ts`, `redact.ts`, `mcp-probe.ts` имели локальные `inferTransport` вместо `infer-mcp-transport.ts`.

#### D-16: Два `parseSemver` в Claude

- `version/detect.ts` — извлекает semver из CLI stdout (`string | null`)
- `version/matrix.ts` — парсит numeric triple (`[number, number, number] | null`)

---

### Tier 3 — Cursor/Codex + application (D-17…D-25)

#### D-17: Adapter shell

`cursor/adapter.ts` ≡ `codex/adapter.ts` — `path.resolve` → `Promise.all([detectVersion, walkProjectScopes])` → `buildProjectSnapshot`.

#### D-19: Resolver trio

`makeReason`, `computeUnknownRate`, `findAgentById`, `AgentNotFoundError` — идентичны в 3 адаптерах.

#### D-23: CLI ↔ Server

`resolveContextOption` (cli) vs `parseContextFromQuery` (server); pending JSON validation в `diff`/`apply` и server routes.

#### D-24: Scan guard

`requireLastScan` в `agents.ts`/`graph.ts`; ~10× inline `"No scan available"` в других routes.

#### D-25: UI formatters

`formatSourceLine` в `WarningsPanel.tsx`, `WhyPanel.tsx`, `ResourceDetailPanel.tsx`; `agentPath` в `AgentList.tsx`, `AgentsWorkspace.tsx`.

---

### Tier 4 — Test helpers (D-26…D-30)

| ID | Описание | Файлов |
|----|----------|--------|
| D-26 | `makeSnapshot`, `mockVersion`, scan-store lifecycle | 12+ |
| D-27 | `tempDirs[]` + `afterEach` cleanup | ~25 |
| D-28 | `makeAgent`, `makeContext`, `makeEffective` | 15 |
| D-29 | Ecosystem factories (exact duplicate) | 2 |
| D-30 | `makeTempGitRepo` variants | 3 |

**Уже хорошо факторизовано:** `tests/fixtures/ecosystem-golden-runner.ts`, `fixture-runtime.ts`, `helpers/isolated-home.ts`.

---

## 4. План рефакторинга по фазам

### Phase 0 — Документация ✓

Этот файл.

### Phase 1 — Foundation utils ✓

- `src/core/sort/compare-strings.ts`
- `src/adapters/shared/fs.ts`
- `src/core/version/semver.ts`

### Phase 2 — Adapter shared modules ✓

- `frontmatter.ts`, `redact.ts`, `mcp-hash.ts`, `cli-version-detect.ts`, `snapshot-id.ts`, `errors.ts`, `empty-environment.ts`, `create-adapter.ts`
- `src/core/resolver/reasons.ts`, `metrics.ts`

### Phase 3 — Claude adapter consolidation ✓

- `io/collect-markdown.ts`, `parsing/agent-configuration.ts`, `discovery/ids.ts`
- Claude adopts `infer-mcp-transport.ts`; `version/detect.ts` uses `cli-version-detect`

### Phase 4 — Application / Server / UI ✓

- `server/helpers/require-scan.ts`, `application/validate-pending.ts`, `ui/format/`

### Phase 5 — Test infrastructure ✓

- `tests/helpers/matrix-patch.ts`, `platform-golden-runner.ts`, scan/model/temp/git fixtures

---

## 5. Риски

| Риск | Митигация |
|------|-----------|
| Изменение deterministic sort ломает golden fixtures | `npm run test` после каждой фазы; golden diff review |
| Matrix patching в тестах | Централизовать `withMatrixPatch`; restore в `finally` |
| Collision resolution regression | Fixture regression tests для agents |
| Semver parsing edge cases | Сохранить два контекста (extract vs tuple) с разными именами |
| Platform paths в core | Только `adapters/shared/` или per-platform `paths.ts` |

---

## 6. Оценка объёма

| Область | Строк-дублей (оценка) |
|---------|----------------------|
| Adapter fs/parsing/redact | ~800–1200 |
| Version detect/matrix | ~400–600 |
| Claude agents/managed-overlay | ~300–500 |
| Application/CLI/Server | ~200–400 |
| UI components | ~100–150 |
| Tests | ~600–1000 |
| **Итого** | **~2400–3850** |

---

## 7. Существующая унификация (reference)

| Модуль | Используется | Не использовался (до Phase 3) |
|--------|--------------|-------------------------------|
| `src/adapters/shared/infer-mcp-transport.ts` | Cursor, Codex MCP | Claude `mcp.ts`, `redact.ts` |
| `src/adapters/codex/discovery/paths.ts` | Codex discovery | Claude, Cursor (нет `paths.ts`) |
| `tests/fixtures/ecosystem-golden-runner.ts` | Ecosystem goldens | Claude/Codex/Cursor goldens |
