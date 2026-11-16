# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Puectjeck/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Puectjeck/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Deepfield Radar: a token launch radar that prices pre-token protocols off the
multiples their launched peers actually trade at. It reads a sealed DefiLlama
snapshot, covers every protocol on the house watchlist, applies the watchlist's
own product test to the whole universe to find the early protocols below the
floor, and ranks them all by an implied value whose arithmetic is shown in
full: TVL x the category's peer multiple (the median market-cap/TVL of its
launched protocols in the same snapshot) x a size factor (the launched set
prices size at a discount, measured on the set itself) x momentum x tenure x
breadth. Every constant in the model was settled by a leave-one-out check the
program runs on every build: price each launched protocol as if it were still
pre-token, from the others alone, and keep the setting that lands nearest its
real market cap (on this snapshot the median miss is a factor of x3.85, against
x5.16 for the previous configuration; the method page of the dashboard quotes
the check in full). Every row carries a farm plan with concrete steps, costs
and times, summed in the plan itself, and the dashboard separates the launched
peers it learned prices from from the pre-token board it ranks. Node 22,
standard library only, no network at run time.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

The grader mounts the sealed snapshot at `/input` and the program writes
`board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to
`/output`. Running it twice on the same snapshot writes the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
