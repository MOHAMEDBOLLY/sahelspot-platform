# Architecture

## Status

No architecture has been implemented yet. This document records decisions as they are made, sprint by sprint — it is not a speculative design written ahead of the code.

## Guiding principles

These principles govern every architectural decision in this project:

- **Simplicity over cleverness.** Choose the boring, well-understood solution.
- **No unnecessary abstractions.** Add structure only when a real, current need justifies it.
- **No premature optimization.** Optimize when a measured problem exists, not before.
- **No microservices.** This is a single, cohesive application, not a distributed system.
- **Small, incremental sprints.** Architecture evolves in reviewed, approved steps.

## Current structure

```
sahelspot-platform/
├── backend/     # server-side application (not yet initialized)
├── frontend/    # client-side application (not yet initialized)
└── docs/        # project documentation
```

No framework, language runtime, or dependency has been installed in either `backend/` or `frontend/`. Those choices will be proposed and explained before implementation, in a future sprint.

## Open decisions

The following are intentionally undecided as of Sprint 0:

- Backend framework and language.
- Frontend framework and language.
- Database engine (see [`DATABASE.md`](DATABASE.md)).
- Deployment/hosting model.
- Authentication approach.

Each will be addressed as its own sprint, with the reasoning explained before any code is written.
