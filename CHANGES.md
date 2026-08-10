# What changed in this update

## New: "Time In / Out" face recognition clock

- The login screen now shows two choices first: **Login to POS** (unchanged)
  and **Time In / Out (Face ID)** (new).
- Time In / Out opens the camera, watches for a face, and matches it against
  everyone who has enrolled Face ID in **Leeya Kaizen App** (under My Profile,
  or Staff & PINs → Employee Profile for an Owner/Manager enrolling someone).
- On a confident match it stamps time in (or time out, if they already timed
  in today) and shows a confirmation for a couple of seconds, then returns to
  the chooser screen automatically.
- If nobody has enrolled Face ID yet, or the face isn't recognized, it says so
  plainly and suggests enrolling in Kaizen App — it never guesses.

## How it avoids duplicate/conflicting attendance

- POS does **not** keep its own attendance data. The stamp is written
  directly into Leeya Kaizen App's own attendance store (same Supabase
  project, table `kaizen_state`), using the same `staffId + date` rule Kaizen
  already uses: no record yet → time in; a record with no time out yet →
  time out; already complete → it just says "Already complete for today" and
  does not create a second entry.
- Kaizen App was updated to defend against a subtler risk: since it now has
  *two* independent writers (itself, and POS's face clock), Kaizen re-checks
  the server's attendance list right before every save and merges in any
  record it doesn't have locally yet, instead of blindly overwriting with a
  possibly-stale in-memory copy. That's what stops a POS clock-in from ever
  getting silently erased by an unrelated Kaizen save happening around the
  same time.
- Every attendance record now also carries a `source` tag (Self-stamp /
  Manual / Face ID (POS) / Legacy), visible as a badge in Kaizen's Attendance
  Log, so you can always see where a stamp came from.

## What was intentionally left alone

- POS's own staff list/PINs (with `posAccess`, `commissionRate`, etc.) are
  **not** merged with Kaizen's staff list. They serve different purposes —
  POS's PIN controls who can operate the register and void sales; Kaizen's
  PIN controls HR/ops access. Unifying them is possible later if you want a
  single staff directory across both apps, but it's a bigger change (POS has
  fields Kaizen doesn't track) and wasn't part of this request.
- Nothing about sales, bookings, catalog, customers, or POS permissions was
  touched.

## Setup needed on your end

Nothing new — this update uses the **same Supabase project** your POS app is
already configured against ("AYauder's Project"), just a different table
(`kaizen_state`, which Kaizen App's earlier setup already created with the
right permissions). No new environment variables, no new npm packages
(face-api.js loads from a CDN, pinned to version 1.7.15 so its face
measurements stay consistent with the copy Kaizen App uses).

## To publish this update

```bash
cd leeya-pos-app-updated
git add -A
git commit -m "Add Face ID Time In/Out clock, synced to Leeya Kaizen App"
git push
```

If `leeyapos` on GitHub is already connected to Vercel, this push redeploys
automatically. If you'd rather patch your existing local clone instead of
using this folder wholesale, the only files touched were:
- `index.html` (added the face-api.js script tag)
- `src/App.jsx` (added the Face ID helpers/components, and swapped the
  plain `<Login/>` for the new `<EntryGate/>` on the logged-out screen)

## One real limitation worth knowing

Face recognition on a phone/tablet camera is good but not perfect — lighting,
camera quality, and how similar two people look all affect it. The matcher
requires two consecutive confident frames and rejects anything ambiguous
(two people scoring nearly the same) rather than guessing, which cuts down
false matches at the cost of occasionally asking someone to try again. If
that trade-off ever causes real problems, the threshold is adjustable
(`FACE_MATCH_THRESHOLD` near the top of `App.jsx`).
