# UI Surface Plan — закрытие gap между логикой и интерфейсом

**Дата:** 2026-09-01 (UI-A IA update)  
**Baseline:** `feat/ui-a-agents-workspace` (V1 + EC merged; UI-A complete)  
**Статус:** **отревьюирован 2026-08-30** — принят с поправками, промоутирован в `TASKS.md` как фаза V1. **UI-A (2026-09-01)** — dashboard IA restructure complete; см. [«Текущее состояние (post-UI-A)»](#текущее-состояние-post-ui-a). При расхождении с `TASKS.md` источник истины — `TASKS.md`.

---

## Резюме

Backend, CLI и golden corpus заметно опережают UI. По оценке **~45–55%** реализованной логики имеет полноценную поверхность в браузере. CLI сейчас полнее UI для M2 (probe, simulate, warnings) и M3 (diff, apply, rollback).

Предлагается фаза **V1 — UI Surface** после merge EC: закрыть gap **без новой resolver/discovery логики** — только wiring существующих API в интерфейс и связность вкладок.

---

## Текущее состояние (post-UI-A)

### Вкладки dashboard (три top-level)

| Tab | Что показывает | Слой |
|-----|----------------|------|
| **Ecosystem** | declared inventory — все платформы, compat badges, detail panel, health | declared |
| **Agents** | master-detail workspace: список агентов слева, inspector справа | effective |
| **Simulation** | managed policy overlay preview | effective (simulated) |

Header: brand + `ScanPanel` only. **Нет** глобального `AgentSelector` — выбор агента только внутри Agents workspace.

### Agents workspace (master-detail)

| Sub-tab | Что показывает | Слой |
|---------|----------------|------|
| Overview | agent meta (scope, path, status) + declared configuration block | declared + effective meta |
| Context | execution preset + unknown rate + drift banner | effective |
| Capabilities | effective capabilities + Why panel + declared/effective pairs | effective |
| Warnings | per-agent и all-agents warnings | effective |
| Graph | React Flow inspection graph **для выбранного агента** | effective |
| Editor | in-memory tool toggles (Claude-only) | desired (M3-01) |

Chrome: context preset control и `DriftBanner` — только внутри Agents workspace, не в header.

**Graph per-agent:** `GET /api/graph?context=&agent=<id>` возвращает subgraph выбранного агента; `GraphView` не fetch'ит без `agentId`. Omitting `agent` сохраняет полный multi-agent graph (CLI/tests).

**Ecosystem bridge:** «Resolve as agent X» из Ecosystem detail panel → Agents tab, Capabilities sub-tab; return banner восстанавливает selection на Ecosystem canvas.

### API → UI wiring (`src/ui/api.ts`)

| Endpoint | UI client | Tab / component |
|----------|-----------|-----------------|
| `GET /api/project` | ✅ | header / ScanPanel |
| `POST /api/project/scan` | ✅ | ScanPanel |
| `POST /api/project/browse` | ✅ | ScanPanel |
| `GET /api/agents` | ✅ | Agents workspace list |
| `GET /api/agents/:id/effective` | ✅ | Capabilities, Editor, Context |
| `GET /api/capabilities/:id/explain` | ✅ | WhyPanel |
| `GET /api/graph` (+ optional `agent`) | ✅ | GraphView (per-agent in Agents workspace) |
| `GET /api/warnings` | ✅ | WarningsPanel |
| `GET /api/ecosystem` (+ resource/content) | ✅ | EcosystemView |
| `POST /api/simulate/managed` | ✅ | SimulationView |
| `POST /api/plan` | ✅ | AgentEditor (read-only preview) |
| `POST /api/mcp/:id/probe` | ❌ | — |
| `POST /api/apply` | ❌ | — |
| `POST /api/rollback/:id` | ❌ | — |
| `GET /api/history` | ❌ | — |

**4 endpoint-группы без UI-клиента** (apply, rollback, history, MCP probe — explicit deferrals).

### CLI vs UI

CLI (`agent-manager`): `scan`, `status`, `agents`, `explain`, `warnings`, `probe-mcp`, `simulate`, `diff`, `apply`, `rollback`.

UI покрывает первые четыре + graph. Остальное — terminal-only.

---

## Оценка покрытия по milestone

```
                    Backend/API    CLI       UI (main)
M0 Discovery         ████████░░     ████░░    ███░░░░░   (~40%)
M1 Resolver          ██████████     ████████  █████░░░   (~55%)
M2 Probe/Simulate    ████████░░     ████████  ██░░░░░░   (~20%)
M3 Editor            ████████░░     ████████  █░░░░░░░   (~15%)
EC Ecosystem         (EC branch)    —         —          (0% on main)
```

---

## Ключевые gap'ы

### 1. Warnings не видны пользователю

Resolver вычисляет `effective.warnings[]` (security findings, trust, shadowing, plugin limits, ignored fields). API `GET /api/warnings` агрегирует warnings по всем active agents.

**UI:** данные загружаются с effective, но **нигде не рендерятся**. Пользователь не видит `bypassPermissions`, `.md` vs `.mdc` (Cursor), F9 plugin limits и т.д.

### 2. M3 workflow обрывается на половине

Backend: plan → diff → backup → apply → rollback → history (M3-02…M3-03 done).

**UI:** только M3-01 — чекбоксы tools in-memory. Nav badge «pending» есть; preview diff, confirm apply, snapshot-changed dialog, rollback, history — отсутствуют.

Editor также **Claude-only** на уровне типов (`editor-store.ts` импортирует `ClaudeAgent`). Apply/plan API возвращает `UnsupportedPlatformError` для cursor/codex.

### 3. Declared config не показан

`Agent.configuration` (tools, model, permissionMode, skills, hooks, …) доступен в snapshot. Agents tab показывает только meta (scope, path, status). Declared vs effective `permissionMode` (P1/P2) resolver считает, dedicated UI нет.

### 4. Capabilities list — урезанный

`EffectiveCapabilities` показывает id + status. Не показаны: `kind`, `enforcement`, группировка (tools / skills / instructions / permissions / MCP).

### 5. Graph без drill-down

Graph строится из тех же resolved данных. Node click не открывает Why panel и не синхronizируется с Capabilities tab.

### 6. Discovery lists — только counts

Overview показывает числа skills/instructions/MCP. Нет списков с source path, scope, invalid reasons (кроме Agents). Settings layers, trust state, environment — не в UI.

### 7. Snapshot-level warnings (A10 budget)

`ProjectSnapshot.warnings` (description budget) не отображаются ни на Overview, ни отдельной панелью.

### 8. ~~Два продукта после merge EC~~ — закрыто UI-A

**Было:** Ecosystem tab (declared) и пять отдельных effective tabs (Context, Capabilities, Graph, Editor, Warnings) без связности.

**Сейчас (UI-A):** три top-level tabs; effective layer собран в Agents master-detail workspace; Ecosystem bridge ведёт в Capabilities sub-tab; graph scoped per selected agent.

---

## Архитектурное решение (V1 + UI-A)

**Принцип:** UI-only phases. Новые API только если неизбежно (например, optional `agent` на graph route). Resolver/discovery/matrix — out of scope.

**Два слоя UI (реализовано):**

```
Declared layer                    Effective layer
─────────────────────────         ─────────────────────────────────────
Ecosystem tab                     Agents workspace (master-detail)
(inventory, compat,               ├─ agent list (left)
 detail, health)                  ├─ context preset + drift banner
                                  └─ sub-tabs: Overview | Context |
                                     Capabilities | Warnings | Graph | Editor
        │                                    ▲
        └──── bridge «Resolve as agent X» ───┘
              (lands on Capabilities sub-tab)

Simulation tab — managed policy overlay (separate top-level context)
```

**Navigation model:** два уровня — top tabs (declared vs effective vs simulation) и sub-tabs внутри Agents workspace. Graph и Why panel всегда в контексте выбранного агента.

**Gate (closed):** V1 wired compliance surfaces; UI-A collapsed eight top-level tabs into three and made the two-layer data model the only navigation path.

---

## Предлагаемая фаза V1 — UI Surface

Order: V1-01 → … → V1-10. Задачи атомарные; каждая — handoff в `docs/tasks/V1-*.md` по шаблону.

| ID | Title | Scope IN | Acceptance (кратко) |
|----|-------|----------|---------------------|
| **V1-01** | Warnings panel | `src/ui/api.ts`, новый `WarningsPanel.tsx`, Capabilities или отдельная вкладка | `GET /api/warnings` + per-agent warnings из effective; severity, category, message; фильтр по agent |
| **V1-02** | Agent declared detail | расширить Agents tab или side panel | frontmatter as-is: tools, model, permissionMode, skills; invalid/ambiguous/collision как сейчас + configuration block |
| **V1-03** | Permission mode summary | panel на Context или Capabilities | declared vs effective permissionMode; P2 «ignored» явно |
| **V1-04** | Capabilities list depth | `EffectiveCapabilities.tsx` | kind badge, enforcement badge, группировка или filter-by-kind |
| **V1-05** | Graph → Why bridge | `GraphView.tsx`, `App.tsx` | click node → select capability → Why panel (reuse existing fetchExplain) |
| **V1-06** | Snapshot warnings on Overview/Ecosystem | health или project strip | `snapshot.warnings` (A10 budget и др.) видны после scan |
| **V1-07** | M3 plan preview | `api.ts`, `AgentEditor` или modal | `POST /api/plan` → diff files/fields; read-only preview |
| **V1-08** | M3 apply + confirm | apply flow UI | confirm dialog; snapshot-changed 409 handling; post-apply message per SPEC M3 #5 |
| **V1-09** | M3 history + rollback | history sidebar/modal | `GET /api/history`, `POST /api/rollback/:id` с confirm |
| **V1-10** | Ecosystem → effective bridge | post-EC only | click agent resource → switch platform if needed, select agent, open Capabilities |

### Quick wins (можно выделить в V1.0 release)

V1-01, V1-02, V1-04, V1-05 — максимум value, минимум backend.

### Отложить (V1.x или отдельная фаза)

| Feature | Причина |
|---------|---------|
| MCP probe UI | confirm flow + isolated process; developer/test tone |
| Managed simulation UI | niche; CLI достаточен для v1 |
| Cursor/Codex editor + apply | `assertClaudePlatform`; отдельное решение по scope |
| Full settings layers browser | частично покрывается EC detail panel |
| Coverage report UI | CI-only metric §11.4; не user-facing |
| Environment vars panel | key names only; low priority |

---

## Scope OUT (invariants)

- Новая resolver/discovery логика
- Observed layer (§9, S0 decision)
- Permission engine (§2.3 non-goals)
- Writes в `.claude/**` beyond existing M3 apply path
- Persistent desired state / profiles
- Drag-and-drop graph editing

---

## Зависимости и риски

| Risk | Mitigation |
|------|------------|
| EC merge меняет nav (Overview → Ecosystem) | V1-10 и V1-06 завязаны на post-EC layout; V1-01…V1-05 можно начать параллельно на main |
| Editor Claude-only | V1-07…V1-09 явно Claude-only в UI; cursor/codex — disabled state + caption |
| Warnings volume на больших проектах | pagination или collapse by category |
| Apply destructive | двойной confirm; reuse API `confirmed` / `acknowledgeSnapshotChange` |

---

## Критерии завершения фазы V1

1. Каждый endpoint из § «API → UI wiring» либо wired, либо explicitly deferred с reason в TASKS.
2. CLI больше не единственный способ для warnings, plan, apply, rollback на Claude projects.
3. Пользователь видит declared **и** effective для выбранного agent без чтения JSON/API.
4. `npm run test` + `npm run typecheck` green; UI smoke не ломает hermetic fixtures.
5. ROADMAP/TASKS обновлены orchestrator'ом после утверждения этого документа.

---

## Связанные документы

- [SPEC.md §10](./SPEC.md) — milestone acceptance (M0–M3)
- [SPEC.md §12.4–12.5](./SPEC.md) — API/CLI contract
- [ROADMAP.md](./ROADMAP.md) — EC phase, post-v0.1 backlog
- [TASKS.md](./TASKS.md) — текущий backlog (V1 не добавлен до ревью)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-31 | Initial draft from UI vs logic gap analysis (`main` baseline) |
| 2026-09-01 | UI-A complete — dashboard IA: 3 top tabs, Agents master-detail with 6 sub-tabs, graph per-agent scope, ecosystem bridge |

---

## Вердикт ревью (2026-08-30)

Проверено по коду на `28a510b`, не по документу. **Скоуп подтверждён**, четыре поправки.

### Подтверждено

Семь групп endpoint'ов зарегистрированы в `src/server/index.ts:34-45` и не имеют клиента в `src/ui/api.ts`: warnings, mcp probe, simulate, plan, apply, rollback, history. Точечные gap'ы тоже держатся — warnings не рендерятся нигде в `src/ui/`, `AgentList.tsx` не трогает `configuration`, `EffectiveCapabilities.tsx:43` показывает только `status`, в `GraphView.tsx` нет ни одного обработчика клика, `editor-store.ts:2` типизирован под `ClaudeAgent`.

### Поправка 1 — гейт снят, строка про ecosystem устарела

EC влит в `main` (994dd0e, PR #4); `fetchEcosystem*` живут в `api.ts:140-150`. Строка `GET /api/ecosystem` в таблице wiring («❌ на main, EC branch only») неверна с момента merge. Разблокированы все десять задач, а не только «quick wins».

### Поправка 2 — V1-01, V1-03 и V1-04 не «quick wins», а дефекты соответствия

Документ подаёт их как «максимум value, минимум backend». По спеку это нарушения:

- `security-findings.ts:71` производит требуемую §2.4 формулировку про Bash-guardrail, UI её не показывает, а `denied` рисует как голый факт — §2.4 + инвариант 12;
- §7.4 называет показ пары declared/effective **обязательным**, `permissionMode` не встречается в `src/ui/` вообще — плюс это acceptance M1 #3, #4 и #6, закрытые по CLI;
- инвариант 3 требует enforcement при каждом утверждении; в списке capability его нет до клика.

В backlog они идут первыми и названы своим именем.

### Поправка 3 — V1-03 (в новой нумерации V1-02) шире, чем в плане

План ограничивает declared/effective полем `permissionMode`. §7.4 перечисляет четыре обязательных случая: `permissionMode`, `model` (F8), поля plugin-агентов (F9) и всю конфигурацию в контексте `fork` (T3).

### Поправка 4 — V1-06 сжимается

План считает, что `snapshot.warnings` не видны нигде. После EC они частично на поверхности: `ecosystem-health.ts:260-300` раскладывает их по severity и линкует на ресурсы канваса, `EcosystemHealth.tsx:120-122` рендерит счётчики. Не хватает текстов сообщений, а не счётчиков — задача сливается с warnings-панелью.

### Изменение приоритета — M3 в UI урезан

План отводит три задачи из десяти (V1-07…V1-09) на plan → apply → rollback → history. §14 ставит редактирование седьмым приоритетом из восьми. В backlog остаётся read-only plan preview; apply, rollback, history и MCP probe записаны как явные deferral'ы с причинами. Это освобождает примерно треть фазы в пользу D2 — доказательной базы, на которой стоит главный тезис продукта.

### Итоговое отображение задач

| План | Backlog | Что изменилось |
|---|---|---|
| V1-01 + V1-06 | **V1-01** | Слиты; snapshot-warnings — drill-down от существующих счётчиков |
| V1-03 | **V1-02** | Расширен с `permissionMode` до F8 / F9 / T3 |
| V1-04 | **V1-03** | Поднят по приоритету как инвариант 3 |
| V1-02 | **V1-04** | Без изменений |
| V1-05 | **V1-05** | Без изменений |
| V1-10 | **V1-06** | Гейт снят, идёт в этой же фазе |
| V1-07 | **V1-07** | Только read-only preview |
| V1-08, V1-09 | — | Deferral с причиной (§14) |
