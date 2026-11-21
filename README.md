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
- 📸 **AI dish → recipe** — snap photos of a finished dish (plus an optional
  description) and an AI vision model reverse-engineers a full recipe: title,
  ingredients, steps, tags, category, and an estimated serving count, with
  ingredients scaled to the servings you want.
- ✨ **AI paste → recipe** — paste messy text (notes, a blog post, an Instagram
  caption) and get it back as a clean, structured recipe.
- 🛒 **Shopping list** — pick recipes and get one combined, check-off-able
  grocery list (saved per device):
  - **Smart matching** — the same ingredient written different ways is one
    item: "2 cloves garlic, minced", "Sauce: garlic" and "蒜頭 4粒" all count
    as garlic; scallion = green onion = spring onion.
  - **Amount totals** — amounts are added up across recipes, e.g. oyster
    sauce 2 + 2 + 1 tbsp shows as **5 tbsp**; 3 × 1 tsp sugar shows as
    **1 tbsp**; lines without an amount show as "plus some".
  - **Store sections** — items are grouped by aisle (produce, meat, seafood,
    eggs/dairy/tofu, rice/noodles, sauces, spices/oils, dry goods, drinks).
- ⚖️ **Ingredient scaler** — ½× to 3× on any recipe page. Amounts (including
  grams in brackets) update on screen; the saved recipe and the shopping list
  keep the original amounts.
- 👩‍🍳 **Cook mode** — tap "Start cooking" for a full-screen, one-step-at-a-time
  view with big Back/Next buttons, an ingredients panel at your chosen scale,
  and the screen kept awake. On a laptop, arrow keys move between steps.
- ⭐ **Favorites and recently cooked** — star recipes, and log when you make
  them ("I made this today", or finish cook mode). Each recipe shows how often
  and when you last cooked it, and the home screen lists your favorites and
  the last 5 recipes you made (saved per device).
- 🗒️ **Cooking notes** — an append-only history of tweaks and refinements on
  each recipe.
- 🤖 **Recipe agent API** — a token-protected HTTP API so an AI assistant can
  search, refine, and add recipes (new ones land in a review queue for the
  owner to approve). Ingredients must be sent as plain-text lines.
- 📱 **One codebase** for native and web via `expo-router`.

## Ingredient style

All ingredients follow one format, so matching, totals, and scaling work:

```
<amount> <unit> <ingredient>, <prep>
```

- `2 cloves garlic, minced` · `300 g pork belly, sliced` · `Salt, to taste`
- Units: `g`, `kg`, `ml`, `L`, `tsp`, `tbsp`, `cup`, `oz`, `lb`
- English name first; an original Chinese name goes in brackets:
  `1 tbsp light soy sauce (生抽)`
- Recipe parts as a prefix: `Marinade: 1 tsp soy sauce`
- Preferred names: scallion, cornstarch, Shaoxing wine, light/dark soy sauce,
  cooking oil

The AI imports (paste → recipe, dish → recipe) write ingredients in this style
automatically.

## Tech stack

| Layer     | Choice |
|-----------|--------|
| App       | Expo (React Native) + `expo-router`, TypeScript |
| Backend   | Supabase (Postgres + Storage + Auth + Edge Functions) |
| AI        | OpenAI (called only from Edge Functions; the key never ships in the app) |
| Auth      | Supabase magic-link (passwordless email) |
| Hosting   | EAS Hosting (web) |

## Project structure

```
app/                       # Screens (expo-router file-based routes)
  (tabs)/index.tsx         #   My Recipes: folder browser + search
  (tabs)/shopping.tsx      #   Shopping list
  (tabs)/account.tsx       #   Magic-link login / account
  category/[name]          #   Recipes within a category
  recipe/[id]              #   Recipe detail, scaler, favorite, cooking notes
  cook/[id]                #   Cook mode (one step at a time)
  edit/[id]                #   Create / edit form, incl. AI import (owner only)
src/
  data/                    # recipeStore, folders, notes, shopping list,
                           #   kitchenLog (favorites + cooked history), mock data
  lib/                     # supabase client, auth, AI clients, storage, theme
    ingredientKey.ts       #   Canonical ingredient names (shopping-list matching)
    quantity.ts            #   Read, scale, and add up ingredient amounts
    storeSection.ts        #   Ingredient → store section
    deviceStorage.ts       #   Per-device storage (shopping list, favorites)
  types/                   # Recipe model
supabase/
  schema.sql               # Tables, indexes, RLS policies, storage bucket
  *.sql                    # Later migrations (folders, notes, review, soft delete)
  functions/
    dish-to-recipe/        #   AI: photos of a dish → recipe
    parse-recipe/          #   AI: pasted text → recipe
    recipe-agent/          #   Token-protected API for an AI assistant
```

## Cloning this repo

Cloning gives you the **code only — none of my recipes, photos, or keys.**
All data lives in my Supabase project. To run your own copy, you'll need your
own free [Supabase](https://supabase.com) project (and an
[OpenAI API key](https://platform.openai.com/api-keys) if you want the AI
features), then follow the steps below. Without Supabase values the app falls
back to demo mode with a few sample recipes.

## Getting started

### 1. Install

Requires [Node.js](https://nodejs.org) LTS (e.g. `nvm install --lts`).

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
(public read, owner-only writes). Then run the other `.sql` files in
`supabase/` the same way (`folders`, `recipe_notes`, `recipe_review`,
`recipe_soft_delete`, `recipes_rls`).

> **If you cloned this:** the owner email is hard-coded in the SQL policies.
> Find-and-replace my email with yours in every `supabase/*.sql` file before
> running them, or you won't be able to edit anything.

Then, under **Authentication → URL Configuration**, add your app URLs to
**Redirect URLs** (e.g. your deployed URL and `http://localhost:8081`) so the
magic-link email can return you to the app. Under **Authentication → Sign In /
Providers**, turn off **Allow new users to sign up** so only your account can
log in.

### 4. Set up the AI features (optional)

The AI features run as Supabase Edge Functions, so your OpenAI key stays on
the server. Set these secrets (**Dashboard → Edge Functions → Secrets**, or
`supabase secrets set`):

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | Your OpenAI key (required for AI features) |
| `OWNER_EMAIL` | Your email. **Set this**: it restricts the AI functions to you so no one else can spend your OpenAI credits |
| `OPENAI_MODEL` | Optional model override (default `gpt-4o`) |
| `DISH_MODEL` | Optional model just for dish → recipe (must support images) |

Then deploy the functions:

```bash
supabase functions deploy parse-recipe --project-ref <ref>
supabase functions deploy dish-to-recipe --project-ref <ref>
```

It's also a good idea to set a monthly spending limit in your OpenAI account.
The optional recipe agent API has its own setup notes at the top of
[`supabase/functions/recipe-agent/index.ts`](supabase/functions/recipe-agent/index.ts).

### 5. Run

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
