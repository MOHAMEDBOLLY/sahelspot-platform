# Product

## What this is

SahelSpot Platform is a new, modern platform being built to eventually replace the current SahelSpot DataLab. It is being developed independently, from a clean foundation, with no shared code or infrastructure with any existing system.

The frontend application is named **DataLab Next**.

## Why

*To be filled in as the product direction is defined. This section should capture the core problem being solved and who it's for, in plain language, before any features are scoped.*

## Users

*To be defined — who uses this platform, and what they need from it.*

## Content & publishing model

The platform is **not live-edit**. Editing content and publishing it to the public website are two separate, deliberate steps — an edit is never instantly visible to a website visitor.

- Editors work in a private draft workspace. Changes there never affect what's live until someone explicitly publishes them.
- The workflow a piece of content moves through is: **Edit → Save Draft → Validate → Review → Publish → Published → Website.** Validation and review are checkpoints, not formalities — they exist to catch bad data and get a second look before anything goes live.
- The public website only ever reads **published** content. Draft or in-review content is never visible publicly, under any circumstance.
- Every time content is published, that moment is recorded as a **publish revision** — a snapshot of everything that was live at that point. The platform can instantly roll the live website back to any previous publish revision if something goes out with a mistake in it, without needing to manually re-edit anything.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for how this is reflected in the system's structure, and [`DATABASE.md`](DATABASE.md) for how it's modeled in the data.

## Scope for now

Nothing is in scope yet beyond project setup, the technology stack, and the content/publishing model described above (see [`ARCHITECTURE.md`](ARCHITECTURE.md)). Feature scope will be defined sprint by sprint and recorded here as decisions are made, not speculated ahead of time.

## Out of scope

- Any reference to, migration from, or integration with the existing production SahelSpot system, unless explicitly requested.
