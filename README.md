# Community (`@runmu.sh/ext-community`, id `community`)

First-party extension on the **marketplace** (`community`). Install it from Extensions → Discover, then turn it on per world under Installed. It shows the game's community moments as toasts: one player giving another **kudos**, a **milestone** the community reached, and any other community **event** the game wants to announce. It has no panel and sends nothing to the game.

## Enabling and settings
While it is enabled for a world, the game is told the client understands `Client.Community 1` (`Core.Supports.Add`; `Remove` when it is turned off). Its **Settings** button opens *Settings → Extensions → Community*. Each setting is per world, with an all-worlds fallback:

| Setting | Default | What it does |
|---|---|---|
| **Show kudos** (`kudos`) | on | A toast when one player thanks another. |
| **Show milestones** (`milestones`) | on | A toast when the community reaches a milestone. |
| **Show other community events** (`events`) | on | Every `Client.Community.Event` toast. |
| **Toast time** (`toastSeconds`) | 7 s | How long a community toast stays, 2–60 s. Hovering or focusing the toasts holds them all. |
| **Read them aloud** (`announce`) | on | Says each toast through μClient's screen-reader live region (`Kudos: Vessa → Ivo: for the tour`). |

## GMCP contract
Server → client. Package names are case-insensitive. Each message has a JSON schema in `schema/`, declared in the manifest (`contributes.gmcp[].messages`), and μClient checks the payload against it before the extension sees it.

| Package | Payload | Toast (label · title · body) |
|---|---|---|
| `Client.Community.Kudos` | `{ "giver"?: string, "receiver": string, "message"?: string, "anonymous"?: bool }` | KUDOS · Kudos · `Vessa → Ivo: for the tour`. With `anonymous: true` or no `giver` the giver reads *Someone*. Without `message`, the body ends after the receiver. |
| `Client.Community.Milestone` | `{ "label": string }` | MILESTONE · Milestone · the label |
| `Client.Community.Event` | `{ "kind": string, "text"?: string, "message"?: string }` | INFO · `kind`, without a leading `community_`, so a game can pass its event name as it is (`community_spotlight` → *spotlight*) · `text`, or `message` when `text` is missing |

```json
Client.Community.Kudos { "giver": "Vessa", "receiver": "Ivo", "message": "for the tour" }
Client.Community.Milestone { "label": "1000 scenes logged" }
Client.Community.Event { "kind": "community_spotlight", "text": "Ivo's scene is in the spotlight" }
```

- **A malformed payload** (no `receiver`, a non-string `label`, no `kind`, …) is dropped. One line, `session.error: Client.Community.Kudos rejected by community: $.receiver: required`, goes to the session, at most once a minute per package. A payload that passes the schema but has nothing to show (an empty `label`) is ignored, with a warning in the extension's log.
- **These are events, not state.** A message delivered again is never shown twice. That covers the GMCP snapshot after a reconnect, the extension being turned on mid-session, and history.
- **One toast per player.** Toasts and the spoken line appear only on the client that has the player's attention for that session (effect ownership). With three tabs open, the player sees the toast once.
- **Bursts.** Kudos toast under one group, and other events under another. Three or more of a group within 2 s become one *N new kudos* toast, which keeps counting while the burst goes on. Milestones are never grouped.

Underspire sends these as the Evennia OOB events `community_kudos`, `community_milestone` and `community_<anything>`. A game porting them sends the same keyword arguments as the GMCP payloads above: `community_<x>` becomes `Client.Community.Event { "kind": "<x>", "text": … }`.

## API (`ctx.api('community')`, types `@runmu.sh/ext-community/types`)
```ts
const c = await ctx.api<CommunityApi>('community');
c.kudos({ giver: 'Vessa', receiver: 'Ivo' });        // the same toast as the GMCP message; false when muted or empty
c.milestone({ label: '1000 scenes logged' }, sid);   // sid defaults to the active session
c.event({ kind: 'festival', text: 'starts at dusk' });
c.toKudos(payload);                                  // pure mappers: payload → { moment, kind, title, body } or null
```
Use it to raise community toasts from text: a quick extension or a line stage that recognises `Vessa gives Ivo kudos.` in a game with no GMCP. The mute settings and toast time apply to the API too. The mappers `toKudos`, `toMilestone` and `toEvent` are also named exports of the module.

## Development
```sh
npm install
npm run build        # dist/index.js + manifest check
npm run typecheck
npm test             # node --test in the headless host (@runmu.sh/dev/test)
npm run dev          # dev server with hot reload; μClient → Extensions → Advanced → Developer
```
In μClient's demo (`?demo`), drive it with `window.__demo.gmcp('s-us-1', 'Client.Community.Kudos', { receiver: 'Ivo' })`.
