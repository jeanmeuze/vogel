# Wie ben ik? 🐦 — party flyer game

A mobile-first one-thumb flyer game for a costume party. Guests scan a QR code on the costumed bird's back and play **solo**: each run stands on its own. The further you get in a run, the more **subtle hints** about the mystery bird appear. Nothing is guessed in the app: the game just ends and you get points.

> The answer is the Russet-backed Oropendola (*Psarocolius angustifrons*, NL: roestrugoropendola). Keep this README away from the guests 😉

## How it plays

- Tap to flap. Fly between trees and hanging vines (some carry a woven oropendola nest), and catch feathers.
- Score = feathers + trees passed, doubled in nightmare mode. Your record per mode is kept on your phone.
- **Progressive hints** within a run. The times are in `public/config.js` → `hints`:
  | after | hint |
  | --- | --- |
  | 8 s | a hint card appears top-left showing just the **yellow tail** |
  | 16 s | + the **pale bill and yellowish forehead** |
  | 22 s | **predators from the bird's own region** start hunting you: harpy eagle (dives at you), emerald tree boa (strikes down), capuchin monkey (swings on a vine), toucan (rams you), jaguar (leaps from the ground) |
  | 28 s | + the **russet back** |
  | 36 s | **flags of the range countries** (Colombia, Ecuador, Peru, Bolivia, Venezuela, Brazil) appear on the trees |
  | 45 s | + the **olive head** |
  | 55 s | the bird's **song** plays every ~14 s |
  | 65 s | the full bird |

## Nightmare mode 😈

- **On a player's first visit** they are asked for a name, and the server rolls the dice: **1 in 3** players land in forced nightmare mode, which they can never switch off.
- Everyone else gets a discreet 😈 toggle at the top of the screen to switch nightmare mode on voluntarily.

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

## Admin

`/admin` (PIN = `ADMIN_PIN`) lists all players: name, runs, records and last seen. You can switch each player between **Normaal** and **Nightmare (forced)**, or delete them. The player's phone picks up the change the next time it opens or refocuses the game.

## Deploy to Vercel

The project needs no build step and has zero npm dependencies:

- `public/`: static files (the game and `admin.html`; `cleanUrls` serves it as `/admin`)
- `api/`: serverless functions: `register`, `me`, `score`, `admin/users`

Steps:

1. Push the folder to a Git repo and import it in Vercel (framework preset **Other**). Or run `npx vercel` in the folder.
2. Set the environment variables:

   | Var | Required | Meaning |
   | --- | --- | --- |
   | `ADMIN_PIN` | yes | PIN for `/admin`. On Vercel the admin API is disabled without it. |
   | `NIGHTMARE_CHANCE` | no | Chance of forced nightmare at first registration (default `0.3333`). |
   | `KV_REST_API_URL` + `KV_REST_API_TOKEN` | strongly recommended | Upstash Redis (Vercel Marketplace → *Upstash for Redis*; Vercel sets these automatically). `UPSTASH_REDIS_REST_URL`/`_TOKEN` work too. |

3. Deploy, then make the QR code for your back:
   ```bash
   npx qrcode -t svg -o qr.svg "https://your-project.vercel.app"
   ```

### Storage: important

Users live behind a tiny adapter in `lib/store.js` with four methods: `get`, `put`, `list`, `del`.

- **No Upstash env vars → in-memory.** That's fine locally. On Vercel, though, every serverless instance has its own memory, so the admin list is incomplete and resets on cold starts. The admin page shows a warning when this is the case.
- To keep things working anyway, every phone remembers its own fate (`localStorage`). If the server has forgotten a player, the phone re-registers itself with the same nightmare setting.
- **With Upstash Redis**, everything persists and admin changes are authoritative.
- **Adding a real database later**: implement the same four methods in `lib/store.js` (Postgres, Supabase, …). Nothing else changes. Note that identity is still a random ID per phone in `localStorage`. Real accounts or logins would be the next step if you need them.

## Run locally

```bash
npm run dev            # http://localhost:3000, admin at /admin (PIN 1234 locally)
```

`dev-server.js` mimics Vercel: it serves `public/` and routes `/api/*` to the same function files. Debug helpers on localhost only:
- `http://localhost:3000/?god` makes you invincible.
- In the console, `OG.game.debug.event('ufo')` triggers an event. Others: `storm`, `lightning`, `flip`, `dark`, `quake`, `turbo`, `drunk`, `mirror`, `coconuts`, `wasps`, `balloon`, `topple`, `snap`, `crusher`, `swarm`.
- `OG.game.debug.skip(60)` jumps ahead in time (for testing hints).

Docker (optional, outside Vercel): `docker build -t wie-ben-ik . && docker run -p 3000:3000 -e ADMIN_PIN=... wie-ben-ik`

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
