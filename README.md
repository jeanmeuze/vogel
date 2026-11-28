# Wie ben ik? 🐦 — party flyer game

A mobile-first one-thumb flyer game for a costume party. Guests scan a QR code on the costumed bird's back and play **solo**: each run stands on its own. The further you get in a run, the more **subtle hints** about the mystery bird appear. Nothing is guessed in the app: the game just ends and you get points.

> The answer is the Russet-backed Oropendola (*Psarocolius angustifrons*, NL: roestrugoropendola). Keep this README away from the guests 😉

## How it plays

- Tap to flap. Fly between trees and hanging vines (some carry a woven oropendola nest), and catch feathers.
- Three modes: **normal**, **🔥 hard** and **😈 nightmare**. Players pick one with the buttons on the start screen; a plain tap starts in the mode shown.
- Score = feathers + trees passed, ×1.5 in hard and ×2 in nightmare. Every attempt is stored in the database, with its mode and cause of death.
- 🏆 **Score boards** (button top-right and after each run), visible to everyone: *All games* and *😈 Nightmare*, each with **best per player** and **top 10 ever**, plus *🔥 Hard* and *💀 Causes* (top 10 causes of death).
- **Progressive hints** within a run. The times are in `public/config.js` → `hints`:
  | after | hint |
  | --- | --- |
  | 8 s | a hint card appears top-left showing just the **yellow tail** |
  | 16 s | + the **pale bill and yellowish forehead** |
  | 22 s | **predators from the bird's own region** start hunting you: harpy eagle (dives at you), emerald tree boa (strikes down), capuchin monkey (swings on a vine), toucan (rams you), jaguar (leaps from the ground). Snakes and jaguars always sit in the middle half (25–75%) of the gap between two trees; in normal mode they reach no further than halfway up/down the screen. |
  | 28 s | + the **russet back** |
  | 36 s | **flags of the range countries** (Colombia, Ecuador, Peru, Bolivia, Venezuela, Brazil) appear on the trees |
  | 45 s | + the **olive head** |
  | 55 s | the bird's **song** plays every ~14 s |
  | 65 s | the full bird |

## Nightmare mode 😈

- **On a player's first visit** they enter a name. The server rolls the dice once: **1 in 4** new players get the **"nightmare only"** stamp. They are not told; their game is simply always nightmare and they get no toggle.
- Everyone else picks normal / hard / nightmare before each game. When the picked mode is not nightmare, each game still has a **1 in 4** chance of being a surprise nightmare game (shown as 😈 NIGHTMARE 🎲; the player can still switch).
- The player is remembered per device: an id in `localStorage` plus a long-lived cookie, so either one is enough to recognise the device.

Nightmare mode is faster, has narrower gaps and predators from 5 s onward. It also gets a **random mix of chaos every run**, which gets more frequent and more intense the longer you survive:

- ⚡ lightning bolts with a short warning (they reach down to a random height)
- 🌪️ storms that slow you down, stop you or blow you backwards, with gusts
- 🛸 a UFO whose tractor beam pulls you up to be abducted (and it drops a cow)
- 🙃 gravity flipped
- 🌑 lights out (only a small circle around you is visible)
- 🌋 earthquake (the gaps shake)
- 🚀 turbo
- 🍹 dizzy (your taps arrive late, the screen wobbles)
- 🪞 mirror world
- 🥥 coconut rain
- 🎈 inflated bird (a bigger hitbox)
- 🐾 predator swarms
- silent traps: trees that suddenly topple towards you, vines that snap and fall, gaps that open and close, and "feathers" that turn out to be wasps

Each nightmare run also gets **1–3 random permanent curses**: heavy wings, dancing trees, headwind, narrow gaps, fog, shy feathers, or rush.

## Hard mode 🔥

Hard has every crazy nightmare element (all events, silent traps and curses), but milder, shorter, with more warning and further apart: the first event comes after ~7 s and then every 12 → 6 s (nightmare: 6 → 2.2 s), at most 1 curse, and predators from 12 s. Tune it in `public/config.js` → `hard` (`chaos` holds the duration/power/warning/count multipliers).

## Admin

`/admin` (not linked anywhere). **On the first visit you choose the admin password**; it is stored as a scrypt hash in the database. Go there right after the first deploy so nobody else can claim it. To reset it, delete the `admin_password` row from the `settings` table.

The admin page lists all players with their stamp, all their attempts (mode, score, time, feathers, trees, when), and lets you toggle the "nightmare only" stamp or delete a player (with all their attempts). A deleted player's phone is asked for a name again on the next visit.

## Deploy to Vercel

The project needs no build step and has one npm dependency (`@neondatabase/serverless`):

- `public/`: static files (the game and `admin.html`; `cleanUrls` serves it as `/admin`)
- `api/`: serverless functions: `register`, `me`, `score`, `leaderboard`, `admin/auth`, `admin/users`

Steps:

1. Push the folder to a Git repo and import it in Vercel (framework preset **Other**). Or run `npx vercel` in the folder.
2. Link a **Neon Postgres** database (Vercel → Storage, or `vercel integration add neon`). This sets `DATABASE_URL`; the tables (`users`, `runs`, `settings`) are created automatically. Optional env var: `NIGHTMARE_CHANCE` (default `0.25`).
3. Deploy, then make the QR code for your back:
   ```bash
   npx qrcode -t svg -o qr.svg "https://your-project.vercel.app"
   ```

## Run locally

```bash
npx vercel env pull .env.local   # fetches DATABASE_URL
npm install
npm run dev                      # http://localhost:3000, admin at /admin
```

Note: locally you use the same database as production unless you point `DATABASE_URL` at a separate Neon branch.

`dev-server.js` mimics Vercel: it serves `public/` and routes `/api/*` to the same function files. Debug helpers on localhost only:
- `http://localhost:3000/?god` makes you invincible.
- In the console, `OG.game.debug.event('ufo')` triggers an event. Others: `storm`, `lightning`, `flip`, `dark`, `quake`, `turbo`, `drunk`, `mirror`, `coconuts`, `wasps`, `balloon`, `topple`, `snap`, `crusher`, `swarm`.
- `OG.game.debug.skip(60)` jumps ahead in time (for testing hints).

Docker (optional, outside Vercel): `docker build -t wie-ben-ik . && docker run -p 3000:3000 -e DATABASE_URL=... wie-ben-ik`

## Tuning

Everything is in `public/config.js`:
- physics
- speed, gaps and predator frequency per mode
- nightmare event frequency (`eventEvery`, `rampSeconds`), curses per run and the score multiplier
- hint timings
- `songUrl`

**The song**: by default a synthesized approximation of the liquid, gurgling oropendola song plays. For the real thing, put a recording you're allowed to use in `public/sound/` and set `songUrl: '/sound/song.mp3'`.

## The bird: plumage reference (eBird, Wikipedia, Peru Aves)

- **Body**: overall olive / olive-brown, with a russet back and especially a russet rump.
- **Tail**: yellow outer feathers, brown central pair.
- **Bill**: black in the Amazonian lowland race, pale yellowish in the Andean races (e.g. *alfredi*, which also has a yellowish forehead). The game draws the Andean form.
- **Range**: Colombia, Venezuela, Ecuador, Peru, Bolivia and western Brazil, in Amazonian lowlands and Andean foothills.
