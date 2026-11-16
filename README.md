# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Puectjeck/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Puectjeck/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Deepfield Radar: a token launch radar that prices pre-token protocols off the
multiples their launched peers actually trade at. It reads a sealed DefiLlama
snapshot and ranks EVERY pre-token protocol in it — all 342, the house
watchlist's forty included, none set aside. Each row carries a class its own
snapshot fields assign (core, exchange, bridge, staking-wrapper, versioned or
wrapper): the category classes are priced off their own class's launched
peers, pooled across the class's categories; a versioned release is priced at
its family's share, so sibling releases split one price; a wrapper in a
generic category takes the staking classes' measured haircut. The rest of the
arithmetic is shown in full: TVL x the peer multiple (the median
market-cap/TVL of the launched peers, winsorised and shrunk) x a size factor
(the launched set prices size at a discount, measured on the set itself) x
momentum x tenure x breadth x the class multiplier. Every constant in the
model was settled by a leave-one-out check the program runs on every build:
price each launched protocol as if it were still pre-token, from the others
alone, and keep the setting that lands nearest its real market cap (on this
snapshot the median miss is a factor of x3.85 under the previous board's
pricing and x3.82 under this one's, with the board's coverage up from 198
rows to all 342; the method page of the dashboard quotes the check in full).
Every row carries a farm plan with concrete steps, costs and times, summed in
the plan itself, and the dashboard separates the launched peers it learned
prices from from the pre-token board it ranks. Node 22, standard library
only, no network at run time.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

The grader mounts the sealed snapshot at `/input` and the program writes
`board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to
`/output`. Running it twice on the same snapshot writes the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
