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

По умолчанию API слушает `127.0.0.1:3847` (переменные `HOST`, `PORT`). Для доступа с другой машины в сети: `HOST=0.0.0.0` (ослабляет локальную изоляцию — только для отладки).

При `npm run dev` Vite проксирует `/api/*` на бэкенд. Если UI поднялся на другом порту (например `5174`), задайте `VITE_PORT=5174` для сервера или полный origin в `CAPSIGHT_DEV_ORIGIN` (например `http://localhost:5174`).

## Milestones

```
S0 (spike) → M0 (Discovery) → M1 (Resolver) → M2 (Probe/Graph) → M3 (Editor)
```

Подробности — в [docs/SPEC.md](docs/SPEC.md).
