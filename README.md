# Token Radar — token-radar-01

A program that ranks pre-token DeFi protocols by what their launch would be worth,
and renders the board as a static dashboard.

## What it does

`main.ts` (Node 22, standard library only) reads the sealed DefiLlama snapshot at
`/input/snapshot.json`, scores every rankable pre-token protocol with the model in
`lib/model.ts`, and writes:

- `board.json` — 198 ranked rows (all 40 watchlist protocols + 158 more below the
  floor), each with an implied value and a 6-step farm plan
- `data.js` — the dashboard's dataset (board rows, live-token peers, peer table, farm plans)
- `dashboard/` — the static page (no network, no framework)
- `screenshots/` — board, detail view, filtered view
- `dossier.json` — built with the vendored `vendor/makefun-board.ts`

## The model (`radar-2-peer`)

A protocol is rankable when it records no token (`mcap_usd`, `gecko_id` and `symbol`
all null) and is not a wrapped, staked or bridged product of a token that already
trades — the house watchlist rule, applied to every row, not only the watchlist's 40.
Protocols whose token already trades are kept apart in the Live view at the market's
own value.

```
implied value = TVL × peer multiple × growth × maturity × chains
```

- **Peer multiple**: the category's median market-cap / TVL among live-token
  protocols, shrunk toward the global median (0.2227) by peer count, clamped to
  0.05–1.50. A category prices from its own peers only when at least 3 live
  protocols trade there; otherwise the global median is used, so one outlier peer
  (a 400× multiple exists in the snapshot) can never set the price.
- **Growth**: 7-day TVL change clamped to −50%…+100%, weighted 0.6.
- **Maturity**: 0.75 + up to 0.45 over 3 years tracked with no token (0.90 when the
  listing date is unknown).
- **Chains**: +2% per extra chain, to 1.20.

No protocol name is ever special-cased: the same function scores every row.

Top of the board on this snapshot: Steakhouse Financial ($706.8M implied),
Sentora Curator ($605.6M), Gauntlet ($424.2M), Veda ($400.9M), USDD ($211.5M).

## The dashboard

- **Pre-token board**: sortable columns, search, category / chain / tier filters,
  watchlist-only toggle; click any row for its detail card.
- **Detail view**: implied value, TVL, 7-day change, age, chains, peer multiple, the
  full formula with each factor, and the 6-step farm plan with cost and time per step.
- **Already trading**: the live-token protocols whose ratios price the board.
- **How it is priced**: the formula, constants and the peer table by category.

Views are hash-driven: `#detail=<slug>`, `#cat=<category>`, `#watchlist=1`, `#q=<text>`,
`#tab=live|method`.

## Run it locally

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/token-radar-01-kit/input/snapshot.json
```

Two runs write byte-identical output (the model is a pure function of the snapshot;
nothing reads a clock, a random source or the network). Open
`out/dashboard/index.html` in a browser to see the dashboard.

## Layout

```
main.ts                  entrypoint: snapshot in, board + dashboard + dossier out
lib/model.ts             the ranking model, farm plans, snapshot parsing, gate self-check
vendor/makefun-board.ts  make.fun's dossier library, byte for byte from the kit
dashboard/index.html     page shell
dashboard/app.css        dark radar theme
dashboard/app.js         rendering, sorting, filtering, hash-driven views
screenshots/             1-board.jpg, 2-detail.jpg, 3-filtered.jpg (1440×900)
LICENSE                  MIT
```

## Notes

- Implied values are this entry's own claim, never make.fun's. "Records no token"
  is DefiLlama's record, not proof a protocol has none.
- The snapshot is sealed (as of 2026-11-14) and is not shipped in this repository;
  the grader mounts it at `/input/snapshot.json`.
