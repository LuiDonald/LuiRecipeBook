# agent-api

A bearer-token-protected HTTP API over the `recipes` (and `recipe_notes`)
tables, so an AI assistant can help with meal planning and recipe refinement.

## Setup

1. **Migration** — run [`../../recipe_notes.sql`](../../recipe_notes.sql) in the
   Supabase SQL Editor (creates the `recipe_notes` table).
2. **Secret** — set a long random bearer token:
   ```bash
   # generate one:
   openssl rand -hex 32
   supabase secrets set AGENT_API_TOKEN=<that value> --project-ref <ref>
   ```
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
3. **Deploy with JWT verification OFF** (we use our own bearer token, not a
   Supabase user JWT):
   ```bash
   supabase functions deploy agent-api --no-verify-jwt --project-ref <ref>
   ```

## Auth

Every request must send `Authorization: Bearer <AGENT_API_TOKEN>`.
Missing/incorrect → `401`.

## Endpoints

Base: `https://<project>.supabase.co/functions/v1/agent-api`

| Method | Path | Purpose |
|---|---|---|
| GET | `/recipes?q=&category=&tags=&limit=&offset=` | list / search (paginated); add `includeDeleted`/`onlyDeleted=true` to see soft-deleted recipes |
| GET | `/recipes/:id` | full detail incl. notes / refinement history + `deletedAt`/`deleteReason` |
| PATCH | `/recipes/:id` | update fields (title, description, category, photoUrl, ingredients, steps, tags) |
| DELETE | `/recipes/:id` | soft delete (hidden everywhere, recoverable); optional `{ "reason": "duplicate" }` or `?reason=` |
| POST | `/recipes/:id/restore` | undo a soft delete |
| POST | `/recipes/:id/notes` | append a timestamped cooking note |
| DELETE | `/recipes/:id/notes/:noteId` | permanently remove a note |
| POST | `/recipes` | create a recipe (published immediately and visible in the app) |

### Notes on the data model
- `ingredients`, `steps`, `tags` are arrays of plain strings (the DB stores them
  as `text[]`); there are no separate quantity/unit columns.
- A recipe has a single `photoUrl` (`photos` is a convenience array of 0–1 URLs).
- **Recipe deletes are soft**: `DELETE /recipes/:id` sets `deleted_at` (+ optional
  `delete_reason`). Deleted recipes are hidden from the app and from list/search
  by default; recover with `POST /recipes/:id/restore`. Requires the
  `recipe_soft_delete.sql` migration.
- **Agent-created recipes are published immediately**: `POST /recipes` inserts a
  live recipe that shows up in the app right away (there is no review queue).
- **Note deletes are hard**: `DELETE /recipes/:id/notes/:noteId` removes the row.
- Notes are **append-only** via PATCH: use `POST /recipes/:id/notes`; PATCH rejects
  a `notes` field.
