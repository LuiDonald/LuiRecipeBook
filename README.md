# Recipe

A personal recipe book — a cross-platform (iOS / Android / web) app built with
[Expo](https://expo.dev) and [Supabase](https://supabase.com). Recipes are
organized into folders (Chicken, Beef, Dessert, …), searchable, and editable.
The public app is **read-only**; only the owner can add, edit, or delete
recipes (passwordless magic-link login).

**Live web app:** https://luidonalds-team-recipe.expo.app

## Features

- 📁 **Folder browser** — recipes grouped by category, mirroring the original
  Google Drive folder structure.
- 🔍 **Search** across titles, descriptions, categories, tags, and ingredients.
- 📝 **Structured recipes** — ingredients + numbered steps, tags, and a photo.
- 🔐 **Owner-only editing** — public visitors can browse; a single owner email
  can edit, enforced by Supabase Row Level Security (not just hidden buttons).
- 📷 **Photo uploads** to Supabase Storage (with HEIC → JPEG handling on import).
- 📱 **One codebase** for native and web via `expo-router`.

## Tech stack

| Layer     | Choice |
|-----------|--------|
| App       | Expo (React Native) + `expo-router`, TypeScript |
| Backend   | Supabase (Postgres + Storage + Auth) |
| Auth      | Supabase magic-link (passwordless email) |
| Hosting   | EAS Hosting (web) |

## Project structure

```
app/                 # Screens (expo-router file-based routes)
  index.tsx          #   Home: folder browser + search
  category/[name]    #   Recipes within a category
  recipe/[id]        #   Recipe detail
  edit/[id]          #   Create / edit form (owner only)
  login.tsx          #   Magic-link login
src/
  data/              # recipeStore (observable repo), categories, mock data
  lib/               # supabase client, auth, storage, theme, helpers
  types/             # Recipe model
supabase/schema.sql  # Tables, indexes, RLS policies, storage bucket
```

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy the template and fill in your Supabase values (from the Supabase dashboard,
**Project Settings → API**):

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_OWNER_EMAIL=you@example.com   # the only account allowed to edit
```

> Without Supabase values the app runs in **demo mode** on in-memory sample data,
> so you can develop without a backend.

### 3. Set up the database

In the Supabase dashboard, open **SQL Editor → New query**, paste the contents of
[`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the
`recipes` table, the `recipe-photos` storage bucket, and the security rules
(public read, owner-only writes — the owner email is baked into the policies).

Then, under **Authentication → URL Configuration**, add your app URLs to
**Redirect URLs** (e.g. your deployed URL and `http://localhost:8081`) so the
magic-link email can return you to the app.

### 4. Run

```bash
npm start        # dev server (press w for web, i for iOS, a for Android)
npm run web      # web only
```

## Auth model

- **Everyone** can read recipes (even logged out).
- **Only the owner** (the email in `EXPO_PUBLIC_OWNER_EMAIL`, matched
  case-insensitively) can create/update/delete.
- The UI hides the ＋ / Edit / Delete controls unless you're signed in as the
  owner, but the real enforcement lives in the Supabase RLS policies, which
  reject any write that doesn't come from the owner's authenticated session.

To edit: tap **Log in**, enter the owner email, open the magic link from your
inbox on the same device, and the edit controls appear.

## Deploying the web app

```bash
npx expo export --platform web     # builds ./dist
npx eas-cli deploy --prod          # deploys to EAS Hosting
```

## License

Private project — all rights reserved.
