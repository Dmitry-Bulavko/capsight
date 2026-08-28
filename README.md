# Capsight

**Claude Agent Configuration Inspector** — локальный read-only инспектор конфигурации Claude Code с опциональным редактором (M3).

Отвечает на вопрос: *что конкретный агент реально получает в конкретном режиме запуска, откуда это взялось, и что из этого действительно ограничено*.

## Документация

- [Implementation Specification](docs/SPEC.md) — контракт реализации, milestones, доменная модель

## Stack

| Слой | Технология |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + TypeScript |
| CLI | Commander |
| Тесты | Vitest + golden-файлы |

## Разработка

```bash
npm install
npm run dev          # UI + server
npm run test         # Vitest
npm run cli -- scan  # CLI
```

## Milestones

```
S0 (spike) → M0 (Discovery) → M1 (Resolver) → M2 (Probe/Graph) → M3 (Editor)
```

Подробности — в [docs/SPEC.md](docs/SPEC.md).
