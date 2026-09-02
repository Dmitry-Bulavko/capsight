# UI fixes session — bug log

> Сессия ручных UI-правок. Баги фиксируются здесь по ходу работы; после сессии материал переносится в задачу.

**Дата:** 2026-09-02  
**Контекст:** Agents workspace → inspector tabs

---

## BUG-001 — Capability names hidden under badges

| Поле | Значение |
|------|----------|
| **Страница** | Agents → Capabilities |
| **Компонент** | `EffectiveCapabilities` (`src/ui/components/EffectiveCapabilities.tsx`) |
| **Описание** | Названия capabilities (capabilityId) пропали / оказались под бейджами — не читаются в списке. |
| **Ожидание** | Имя capability видно в каждой строке; бейджи (kind, enforcement, status, observed) не перекрывают текст. |
| **Статус** | fixed |
| **Приоритет** | — |
| **Скриншот** | assets/…image-e3ce9647…png (до) |

### Заметки

- Строка: `.capability-item` — flex row с `.capability-item-primary` (id + kind badge) и `.capability-item-badges` (enforcement, warning, status, observed).
- Стили: `src/ui/styles.css` — `.capability-items-grid`, `.capability-item`, `.capability-item-primary`, `.capability-item-badges`.
- **Root cause (проверено в браузере):** в grid-колонке `minmax(14rem, 1fr)` (~224px) блок бейджей (~230px, `flex-shrink: 0`) занимает всю ширину; `.capability-item-primary` с `flex: 1; min-width: 0` сжимается до **0px** — `.capability-id` получает `width: 0`, текст визуально «пропадает под бейджами».
- **Fix:** `.capability-item` → column layout; имя + kind badge на первой строке (full width), бейджи статуса на второй с `flex-wrap`; grid `minmax(16rem, 1fr)`.

---

## CHANGE-001 — Merge Capabilities + Editor into table view

| Поле | Значение |
|------|----------|
| **Страница** | Agents → Capabilities |
| **Компонент** | `CapabilitiesTable` (новый), удалена вкладка Editor |
| **Описание** | Capabilities и Editor объединены: таблица с колонками Enable / Name / Kind / Enforcement / Status / Observed / Warnings; чекбоксы для editable tools; клик по строке → Why panel; Plan preview при pending edits. |
| **Статус** | done |

---

## CHANGE-002 — Three-column Agents layout

| Поле | Значение |
|------|----------|
| **Страница** | Agents workspace |
| **Описание** | 3 колонки: слева — агенты; центр — таблица capabilities (+ Graph toggle, Why panel); справа aside — Overview / Context / Warnings. |
| **Статус** | done |

---

## CHANGE-003 — Aside accordions (Ecosystem-style)

| Поле | Значение |
|------|----------|
| **Страница** | Agents → правый aside |
| **Описание** | Переключатели Overview/Context/Warnings заменены на `<details>` аккордионы (`DetailAccordion`, те же классы что в Ecosystem ResourceDetailPanel). |
| **Статус** | done |

---

## CHANGE-004 — Graph agent nodes match Ecosystem cards

| Поле | Значение |
|------|----------|
| **Страница** | Agents → Graph |
| **Компонент** | `GraphNodeCard`, `graph-layout`, `build-graph` |
| **Описание** | Узел агента в inspection graph рендерится через `EcosystemResourceCard` (172×150): заголовок AGENT, имя, badge платформы, иконки Platforms. Capability-узлы (tools, MCP, skills…) — компактные `GraphCapabilityCard` (172×68) в том же визуальном языке: цветная рамка, glow, kind + icon, имя без footer. |
| **Статус** | done |

---

## CHANGE-005 — Capabilities table UX polish

| Поле | Значение |
|------|----------|
| **Страница** | Agents → Capabilities |
| **Описание** | Toggle switches вместо чекбоксов Enable; sticky колонки при скролле таблицы; клик по tool/permission → Why panel в правом aside (не в центре); Close восстанавливает аккордионы. |
| **Статус** | done |

---

## CHANGE-006 — Graph UX fixes

| Поле | Значение |
|------|----------|
| **Страница** | Agents → Graph |
| **Описание** | `GraphFlowNodeShell` с Handle — убран спам React Flow #008; клик по tool в графе не переключает на вкладку Capabilities (Why остаётся в aside). |
| **Статус** | done |

---

## BUG-002 — Why panel path stretches aside

| Поле | Значение |
|------|----------|
| **Страница** | Agents → aside → Why |
| **Компонент** | `WhyPanel` |
| **Описание** | Длинный путь в «Source of capability» растягивал колонку и давал горизонтальный скролл. |
| **Fix** | `.why-path-line` с ellipsis + `title`; `overflow-x: hidden` на aside detail. |
| **Статус** | fixed |

---

```markdown
## BUG-NNN — Краткий заголовок

| Поле | Значение |
|------|----------|
| **Страница** | … |
| **Компонент** | … |
| **Описание** | … |
| **Ожидание** | … |
| **Статус** | open |
| **Приоритет** | — |
| **Скриншот** | — |
```
