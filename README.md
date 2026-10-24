# Across the Table — heads-up Texas Hold'em for two phones

Version: v1.4 — the record now saves. Matches won, hands won, and
biggest pot are stored on each phone (localStorage, per opponent —
solo games are recorded vs Bot so they never pollute a record vs a
real opponent), written after every completed hand and match, and a
new match starts with that record carried over. The setup screen shows
the saved record for the names typed, with a Reset button. The version
shown at the very bottom of the page always matches the code served.

A stylish, first-person, heads-up-only Texas Hold'em game built for Terry
and Chandra's Spain trip: the long flight, hotel rooms, and cruise cabin.

**Live site (after Pages is enabled):** https://tkcool28.github.io/Poker/

## What it is

- Portrait phone view, first person: your opponent sits across the felt
  at the top, your cards are big in the foreground at the bottom.
- Texas Hold'em only, heads-up only, play chips only. No real money,
  no account, no casino lobby, no strangers unless you invite them.
- Blinds 10/20, starting stack 1,000 (50 big blinds). The button posts
  the small blind and acts first preflop, second after the flop — the
  standard heads-up rule.
- Trip scoreboard: matches won, hands won, biggest pot. Since v1.4
  it is saved on each phone (localStorage, per opponent), so it
  survives closing the tab and a new match starts with the old record.
  A mid-hand close loses only that hand, not the record. If two phones
  ever disagree, the host's record wins for that match and both phones
  save it at the end, so they re-sync.
- Multiple games at once: fine. Each host phone is its own game and
  the site itself holds no shared state — two pairs just need
  different room codes, since one code can only be claimed by one host
  at a time.
- Solo mode vs a simple bot, for practice and for testing the view
  before the other phone joins.
- Table talk: the comment buttons under the table (Nice hand, Bluffing?,
  etc.) post to a persistent log that survives the next hand, on both
  phones in a 2-phone game. In solo mode the bot talks back.

## How to play (2 phones)

### Online (hotel Wi-Fi, or anywhere with internet)

1. Both phones open the live site. Close other Poker tabs first — a
   second Host tab can steal the room code.
2. Both tap **Online**, type the *same* room code (e.g. `SPAIN`).
3. One phone taps **Host a game** and waits until it says
   **Room SPAIN open**. Only then does the other phone tap
   **Join a game**.
4. Play. The host's phone deals and is the authority on the game state.

If Join says **Host not found**, the host really isn't registered yet
— re-tap Host and wait for the "open" status. If it says the
signalling server dropped, the game retries the join 3 times on its
own; if it still fails, tap **Use Local mode instead** — that mode
needs no server at all and is the reliable choice when you're in the
same room. Connection problems now show as text on the page, never as
a modal popup.

### Local / no internet (plane, cruise cabin)

This is the mode that matters for the trip, so read it before you fly:

1. **While you still have internet**, both phones open the live site
   and leave the tab open. The page itself is a single static site with
   no server calls except the optional PeerJS library in Online mode,
   so Local mode needs no internet after the page is loaded.
2. One phone turns on its personal hotspot; the other phone joins that
   hotspot's Wi-Fi. (Airplane mode + hotspot + Wi-Fi on the joining
   phone works on most phones; test this at home, not at 35,000 feet.)
3. Host phone: tap **Local / No internet** → **Create offer code** →
   **Copy offer**, and send that code to the other phone any way you
   like (text, a shared note, read it out loud).
4. Guest phone: paste the offer into **Paste host's offer code** →
   **Create answer code** → **Copy answer**, and send it back.
5. Host phone: paste the answer into **Paste guest's answer code** →
   **Finish connecting**. The game starts automatically.

If the connection drops mid-hand, rejoin with the same room code
(Online) or redo the offer/answer exchange (Local). Hands are not
saved mid-hand — the saved record only counts finished hands and
matches, so a dropped connection costs at most the hand in progress.

### Your cards, when you're sitting together

By default your cards are face-up on your own phone — fine when you're
in different rooms. If you're sitting across from each other and don't
want a wandering eye to see your hand, uncheck **Keep my cards
face-up** and use **Hold to peek**: your cards stay face-down until
you hold the button, exactly like shielding a real hand.

## The honest trust note

In a two-phone game, one phone has to shuffle and deal. Here the host
deals, so the host's device technically knows both hands. For a
couples game played for bragging rights that is a non-issue, and the
code is open in this repo so anyone can read exactly what it does.

It is **not** a design you would ever play for money, and it is not
trying to be: there is no server shuffle, no anti-cheat, and no
account system. If you ever wanted a money version, that would need a
trusted server dealing — a different project entirely.

## Files

- `index.html` — the whole game UI and connection code (WebRTC +
  PeerJS). No build step, no framework.
- `poker.js` — the pure game engine: deck, hand evaluator, betting,
  showdown, and the solo bot. Runs in a browser and under Node.
- `test.js` — engine tests. Run with `node test.js` (240 checks,
  including 200 bot games that must only ever make legal moves, plus
  seeded-record and rematch-preserves-record checks).

## Enabling GitHub Pages (one time, Terry)

This repo is public and static, so Pages is free:

1. GitHub → Tkcool28/Poker → Settings → Pages.
2. Source: Deploy from a branch → Branch: `main`, folder: `/ (root)`.
3. Save. The site appears at https://tkcool28.github.io/Poker/
   within a minute or two. If it shows a 404 at first, wait and reload
   — Pages takes a moment on the first deploy.

## What v1 deliberately does not do

- No other poker variants yet (Hold'em only; Omaha is the obvious v2).
- No blind clock / escalating blinds — blinds stay 10/20 for the trip.
- No mid-hand reconnect recovery, no chat (preset taunts only),
  no hand history export.
- No App Store app — open the site and use "Add to Home Screen" and
  it behaves like an app for the trip.

## If something looks wrong

The engine is the part that must be right, so it has tests
(`node test.js`). The connection code is the part most likely to be
fiddly on a plane — if Local mode won't connect, check, in order:
both phones are on the same hotspot, both tabs were loaded while
online and never closed, and the offer/answer codes were pasted in
full (they're long — use Copy, don't retype them).
