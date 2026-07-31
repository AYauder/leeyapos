# Leeya Beauty Lounge — POS

A point-of-sale, booking, inventory, and staff management app for Leeya
Beauty Lounge (Balanga City Branch). This is a standalone web app — it
runs in any browser and saves data to your own free Supabase database,
so it works outside of Claude and stays live permanently.

## What's inside

- POS with service tickets, discounts, packages/bundles, and a cash drawer
- Bookings with day/week views
- Customer profiles with purchase history and active packages
- Catalog management (services, products, packages, categories)
- Staff accounts with PIN login and per-account permissions
- Sales history with void, CSV export, and a sales summary report
- Full JSON backup/restore

## One-time setup (about 15 minutes)

### 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New project**. Pick any name and password (save the password
   somewhere safe — you likely won't need it again for this app).
3. Once the project finishes setting up, open **SQL Editor** in the left
   sidebar, click **New query**, paste in the entire contents of
   `supabase-schema.sql` (included in this project), and click **Run**.
   This creates the one table the app needs.
4. Open **Project Settings → API**. You'll need two values from this
   page in step 3 below:
   - **Project URL**
   - **anon public** key

### 2. Get the code running on your computer (optional, for testing)

You'll need [Node.js](https://nodejs.org) installed (any recent version).

```bash
npm install
cp .env.example .env
```

Open the new `.env` file and paste in your Project URL and anon key from
step 1.4 above. Then:

```bash
npm run dev
```

This opens the app at `http://localhost:5173` — try it out. The very
first login will ask for a starting cash amount; the default owner PIN
is **1234** (change it right away under Staff & Settings).

### 3. Put it online for real (free)

The easiest option is **Vercel**:

1. Push this project to a GitHub repository (create a free GitHub
   account first if you don't have one — you can drag-and-drop these
   files into a new repo from github.com's web interface, no command
   line required).
2. Go to [vercel.com](https://vercel.com), sign up with your GitHub
   account, and click **Add New → Project**. Choose the repository you
   just created.
3. Before deploying, expand **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
4. Click **Deploy**. In a minute or two you'll get a live link like
   `leeya-pos.vercel.app` — that's your permanent app URL. Bookmark it
   on every tablet or PC you want to use for the POS.

Any time you want to make changes, edit the files, push to GitHub, and
Vercel redeploys automatically.

## Important notes

- **Change the default PIN.** The seeded owner account uses PIN `1234`.
  Change it on first login under Staff & Settings.
- **Your Supabase anon key is not fully secret.** It's meant to be used
  in the browser, but with the policies in `supabase-schema.sql` it
  does allow anyone who has your app's URL to read/write the shared
  data table. That's fine for internal shop use on trusted devices; if
  you ever need stronger protection, that's a good next step to ask for.
- **Backups.** Use "Download backup" under Staff & Settings regularly —
  it saves everything (sales, customers, catalog, staff, settings) as
  one file you can keep safe or use to restore later.
