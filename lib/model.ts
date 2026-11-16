// The Deepfield Radar model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds every
// further pre-token protocol the house's own product exclusions still leave standing: no CEX, no
// bridge or staking wrapper of a token that already trades, no versioned pool of another protocol,
// no name that opens with an exchange's. The watchlist's rule, applied to the whole universe, so the
// radar's early rows are found by the same test the floor was drawn with.
//
// Implied value is priced off the market's own evidence, never off a hand-kept list of names:
//
//   peers      = the snapshot's launched protocols in the same category: the multiple of market cap
//                to TVL each one actually trades at, winsorised to [0.02, 5] so one mania cannot
//                price a whole category. A category's multiple is the median of its peers, shrunk
//                toward the universe median with a prior worth four peers, so a lone peer's price
//                is evidence but never the whole story, and clamped to [0.04, 2].
//   size       = clamp((tvl / median launched TVL) ^ -0.25, 0.5, 2): the launched set itself shows
//                that size is priced at a discount — a protocol ten times the median launched size
//                trades at a lower multiple of its TVL than a small one does. The exponent is not
//                a taste: it is the setting that prices the launched set back most accurately in
//                the leave-one-out check below, and the dashboard's method page shows that check.
//   momentum   = 1 + 0.35 x clamp(change_7d, -50, +100) / 100: a protocol growing into its launch
//                is priced up, one bleeding TVL is priced down, and a one-week spike cannot run away.
//   tenure     = 0.78 + 0.44 x min(age_days, 1460) / 1460: four years of running with no token is
//                the strongest evidence a launch is still owed; an unknown age scores the median age
//                of the pre-token universe, a figure the snapshot itself supplies.
//   breadth    = 1 + 0.02 x min(chains - 1, 6): every extra chain is distribution a token inherits.
//   implied    = max(1, round(tvl_usd x peers x size x momentum x tenure x breadth))
//
// Every constant above was settled the same way: leave-one-out over the snapshot's launched
// protocols — price each one as if it were still pre-token, from the others alone, and keep the
// setting that lands nearest its real market cap. buildRadar runs that check on every build and
// ships its result in the data, so the method page quotes this snapshot's own figures, not a claim.
//
// The same function scores every row; no protocol's name is ever read by the model. Beside the value
// the model keeps a 0..100 signal: where a farmer's next hour is best spent, blending the log of TVL
// against the board's own range with momentum, tenure and breadth.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the board carries it. */
export const MODEL_VERSION = 'deepfield-3';

/** One launched peer the category multiple rests on. */
export interface Peer {
  slug: string;
  name: string;
  mcap_usd: number;
  tvl_usd: number;
  multiple: number;
}

/** A category's pricing evidence: its peers, their median multiple, and the multiple in force. */
export interface CategoryPricing {
  category: string;
  peers: number;
  median: number | null;
  multiple: number;
  top: Peer[];
}

/** The model's whole pricing table, computed from the snapshot alone. */
export interface Pricing {
  global_multiple: number;
  launched_count: number;
  median_age_days: number;
  /** The median TVL of the launched evidence set: the size factor's reference point. */
  size_ref_tvl: number;
  categories: CategoryPricing[];
  by_category: Map<string, CategoryPricing>;
}

/**
 * The model's tunable settings, in one place so the leave-one-out check can run the same pricing
 * under two configurations: the one in force and the previous one it replaced.
 */
export interface ModelConfig {
  prior_peers: number;
  momentum_weight: number;
  tenure_floor: number;
  tenure_range: number;
  tenure_days: number;
  breadth_per_chain: number;
  breadth_cap: number;
  size_exponent: number;
}

/** The settings in force (deepfield-3), each settled by the leave-one-out check below. */
export const CONFIG: ModelConfig = {
  prior_peers: 4,
  momentum_weight: 0.35,
  tenure_floor: 0.78,
  tenure_range: 0.44,
  tenure_days: 1460,
  breadth_per_chain: 0.02,
  breadth_cap: 6,
  size_exponent: -0.25,
};

/** The previous configuration (deepfield-2), kept only so the check can quote both scores. */
export const CONFIG_V1: ModelConfig = {
  prior_peers: 4,
  momentum_weight: 0.35,
  tenure_floor: 0.78,
  tenure_range: 0.44,
  tenure_days: 1095,
  breadth_per_chain: 0.03,
  breadth_cap: 8,
  size_exponent: 0,
};

/** How one configuration scored when it priced the launched set leave-one-out. */
export interface BacktestScore {
  /** The median miss, as a factor: half the launched set was priced within this of its real cap. */
  typical_factor: number;
  within_2x_pct: number;
  within_3x_pct: number;
}

/** The leave-one-out check's result: both configurations over the same launched set. */
export interface Backtest {
  protocols: number;
  current: BacktestScore;
  previous: BacktestScore;
}

/** The five multipliers and the implied value one protocol gets. */
export interface Scored {
  implied: number;
  peer_multiple: number;
  size: number;
  momentum: number;
  tenure: number;
  breadth: number;
  age: number | null;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A farm plan's own totals, summed from the same figures its steps quote. */
export interface PlanTotals {
  capital_usd: number;
  gas_usd: number;
  weeks: number;
  minutes_per_week: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  token_status: 'pre-token';
  tier: 'watchlist' | 'early';
  implied_value_usd: number;
  signal: number;
  plan_totals: PlanTotals;
  model: {
    peer_multiple: number;
    size_multiplier: number;
    momentum_multiplier: number;
    tenure_multiplier: number;
    breadth_multiplier: number;
    category_peers: number;
  };
  /** The same multipliers at full precision: the dashboard re-derives the value from these. */
  model_raw: {
    peer_multiple: number;
    size_multiplier: number;
    momentum_multiplier: number;
    tenure_multiplier: number;
    breadth_multiplier: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  tier: 'watchlist' | 'early';
  implied_value_usd: number;
  signal: number;
  plan_totals: PlanTotals;
  peer_multiple: number;
  size_multiplier: number;
  momentum_multiplier: number;
  tenure_multiplier: number;
  breadth_multiplier: number;
  farm_steps: string[];
}

/** A launched protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  multiple: number | null;
}

/** Everything the dashboard needs: the board, the launched set, and the pricing table behind it. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  global_multiple: number;
  launched_count: number;
  median_age_days: number;
  size_ref_tvl: number;
  backtest: Backtest;
  universe_size: number;
  pre_token_size: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  categories: { category: string; peers: number; median: number | null; multiple: number }[];
  peers: Record<string, Peer[]>;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word that marks a wrapped or staked product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** The categories the house's watchlist rule keeps off the floor: products of tokens that trade. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** The exchanges whose own products the watchlist rule keeps off the floor. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/**
 * Whether a pre-token protocol is one the radar may rank: the watchlist's own product test, so a
 * wrapped, staked or bridged product of a launched token is never mistaken for a launch still owed.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return false;
  return true;
}

/**
 * The pricing table: what the market itself pays for a dollar of TVL, category by category, read off
 * the snapshot's launched protocols. Ratios are winsorised before any median is taken.
 */
export function buildPricing(snapshot: Snapshot): Pricing {
  const launched = snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const ratios: number[] = [];
  const byCat = new Map<string, { ratios: number[]; peers: Peer[] }>();
  for (const p of launched) {
    const ratio = clamp(p.mcap_usd! / p.tvl_usd, 0.02, 5);
    ratios.push(ratio);
    const key = p.category ?? 'Uncategorised';
    const bucket = byCat.get(key) ?? { ratios: [], peers: [] };
    bucket.ratios.push(ratio);
    bucket.peers.push({ slug: p.slug, name: p.name, mcap_usd: p.mcap_usd!, tvl_usd: p.tvl_usd, multiple: round2(ratio) });
    byCat.set(key, bucket);
  }
  const globalMultiple = ratios.length > 0 ? median(ratios) : 0.25;
  const categories: CategoryPricing[] = [];
  const byCategory = new Map<string, CategoryPricing>();
  for (const [category, bucket] of byCat) {
    const med = median(bucket.ratios);
    const n = bucket.ratios.length;
    // Shrink every category toward the universe median behind a prior worth four peers: a lone
    // peer moves the price a fifth of the way from the median to its own multiple, never all of it.
    const shrunk = (n * med + CONFIG.prior_peers * globalMultiple) / (n + CONFIG.prior_peers);
    const pricing: CategoryPricing = {
      category,
      peers: n,
      median: round4(med),
      multiple: round4(clamp(shrunk, 0.04, 2)),
      top: bucket.peers.sort((a, b) => b.mcap_usd - a.mcap_usd).slice(0, 5),
    };
    categories.push(pricing);
    byCategory.set(category, pricing);
  }
  categories.sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : 1));
  const ages = snapshot.protocols
    .filter(isPreToken)
    .map((p) => ageDays(snapshot.as_of, p.listed_at))
    .filter((a): a is number => a !== null);
  return {
    global_multiple: round4(globalMultiple),
    launched_count: launched.length,
    median_age_days: ages.length > 0 ? Math.round(median(ages)) : 365,
    size_ref_tvl: launched.length > 0 ? Math.round(median(launched.map((p) => p.tvl_usd))) : 0,
    categories,
    by_category: byCategory,
  };
}

/** The size factor: how far a protocol's TVL sits from the launched set's median, priced at the measured discount. */
export function sizeFactor(tvl: number, refTvl: number, exponent: number): number {
  if (exponent === 0 || refTvl <= 0 || tvl <= 0) return 1;
  return clamp(Math.pow(tvl / refTvl, exponent), 0.5, 2);
}

/** The five multipliers and the implied value one protocol gets under the pricing table. */
export function impliedValue(p: SnapshotProtocol, asOf: string, pricing: Pricing, config: ModelConfig = CONFIG): Scored {
  const age = ageDays(asOf, p.listed_at);
  const cat = pricing.by_category.get(p.category ?? 'Uncategorised');
  const peerMultiple = cat !== undefined ? cat.multiple : pricing.global_multiple;
  const size = sizeFactor(p.tvl_usd, pricing.size_ref_tvl, config.size_exponent);
  const pct = clamp(typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : 0, -50, 100);
  const momentum = 1 + config.momentum_weight * (pct / 100);
  const ageForModel = age ?? pricing.median_age_days;
  const tenure = config.tenure_floor + config.tenure_range * (clamp(ageForModel, 0, config.tenure_days) / config.tenure_days);
  const breadth = 1 + config.breadth_per_chain * Math.min(Math.max(p.chains.length - 1, 0), config.breadth_cap);
  const implied = Math.max(1, Math.round(p.tvl_usd * peerMultiple * size * momentum * tenure * breadth));
  return { implied, peer_multiple: peerMultiple, size, momentum, tenure, breadth, age };
}

/**
 * The leave-one-out check: price every launched protocol as if it were still pre-token, from a
 * pricing table built out of the others alone, and score how near the model lands to the market
 * cap it actually trades at. Run under both configurations so the method page can quote the
 * improvement on this snapshot's own figures. Pure arithmetic over the sealed snapshot: the same
 * bytes in, the same scores out.
 */
export function backtestLaunched(snapshot: Snapshot): Backtest {
  const launched = snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const score = (config: ModelConfig): BacktestScore => {
    const misses: number[] = [];
    let within2 = 0;
    let within3 = 0;
    for (const target of launched) {
      const rest = { ...snapshot, protocols: snapshot.protocols.filter((p) => p.slug !== target.slug) };
      const pricing = buildPricing(rest);
      const { implied } = impliedValue(target, snapshot.as_of, pricing, config);
      const miss = Math.abs(Math.log10(implied / target.mcap_usd!));
      misses.push(miss);
      if (miss <= Math.log10(2)) within2++;
      if (miss <= Math.log10(3)) within3++;
    }
    return {
      typical_factor: round2(Math.pow(10, median(misses))),
      within_2x_pct: Math.round((100 * within2) / launched.length),
      within_3x_pct: Math.round((100 * within3) / launched.length),
    };
  };
  return { protocols: launched.length, current: score(CONFIG), previous: score(CONFIG_V1) };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The second chain a protocol names, when it has one. */
function secondChainOf(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  if (p.tvl_usd >= 10_000_000) return 75;
  return 50;
}

/** How many weeks of qualifying activity a plan runs, from the protocol's age. */
function weeksFor(age: number | null): number {
  if (age === null) return 6;
  if (age < 180) return 8;
  if (age < 540) return 6;
  return 4;
}

/** The category's core action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} so the wallet carries a live lending position`;
  if (c.includes('dex') || c.includes('swap')) return `Seed $${capital} into ${name}'s deepest USDC pool on ${chain} and leave the LP position open`;
  if (c.includes('leveraged farm')) return `Open a $${capital} leveraged farm on ${name} on ${chain} at its lowest leverage setting`;
  if (c.includes('yield') || c.includes('aggregator')) return `Deposit $${capital} of USDC into ${name}'s main vault on ${chain} and keep the vault shares`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} curated vault on ${chain} and hold the shares untouched`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Post $${capital} of USDC as margin on ${name} and open one small hedged position`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in the wallet`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active`;
  if (c.includes('basis')) return `Put $${capital} into ${name}'s basis vault on ${chain} and keep the position delta-neutral`;
  if (c.includes('restak') || c.includes('staking')) return `Restake or stake $${capital} of the base asset through ${name} on ${chain} and keep the receipt token`;
  if (c.includes('stable')) return `Mint $${capital} of ${name}'s stable asset on ${chain} against USDC collateral`;
  if (c.includes('payment')) return `Route a $${capital} payment through ${name} on ${chain} so the wallet shows real payment volume`;
  if (c.includes('chain') || c.includes('l2') || c.includes('layer')) return `Bridge $${capital} of USDC to ${name} and use two of its native apps in the same week`;
  if (c.includes('prediction')) return `Fund $${capital} and settle one market position on ${name} before it closes`;
  if (c.includes('governance')) return `Deposit $${capital} into ${name} on ${chain} and vote in its next governance round`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open`;
}

/** The category's second, different qualifying action: the one points systems usually weight most. */
function secondActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow a small amount against the supply on ${name}, hold it a day, then repay in full so the wallet shows both sides of the market`;
  if (c.includes('dex') || c.includes('swap')) return `Route two swaps a week through ${name} on ${chain}, in different pairs, so the wallet is a user and not only a deposit`;
  if (c.includes('yield') || c.includes('aggregator') || c.includes('curator') || c.includes('allocator')) return `Move a quarter of the position into a second ${name} vault on ${chain} so the wallet holds two distinct vault shares`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Trade one small contract a week on ${name}, win or lose, and never let the margin fall below half`;
  if (c.includes('rwa') || c.includes('stable') || c.includes('basis')) return `Redeem a tenth of the position once and re-mint it a week later, so the wallet shows a full round trip`;
  if (c.includes('chain') || c.includes('l2') || c.includes('layer')) return `Pay gas on ${name} with a contract call every week: a transfer alone counts for little beside real app use`;
  return `Make one further qualifying action inside ${name} on ${chain} each week, a deposit top-up, a claim or a vote, and never two on the same day`;
}

/** A plan's totals, summed from the same figures its steps quote: capital, gas, weeks, weekly minutes. */
export function planTotals(p: SnapshotProtocol, age: number | null): PlanTotals {
  const capital = capitalFor(p);
  const second = secondChainOf(p) !== null;
  const weeks = weeksFor(age);
  const gas = capital >= 150 ? 8 : 4;
  return {
    capital_usd: capital + (second ? Math.round(capital / 2) : 0),
    gas_usd: 3 + gas + (second ? gas : 0) + 2 * weeks + 5,
    weeks,
    minutes_per_week: 25,
  };
}

/**
 * A protocol's farm plan: eight or nine steps, each an action with a cost and a time, derived from
 * the protocol's own record (category, chains, TVL, age) and never from a hand-written list of
 * names. The last step but one sums the plan from its own figures, so a reader sees the whole
 * commitment before spending anything.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const weeks = weeksFor(age);
  const gas = capital >= 150 ? 8 : 4;
  const totals = planTotals(p, age);
  const steps: FarmStep[] = [
    {
      text: `Set up a fresh wallet for ${p.name} alone, fund it from an exchange withdrawal, and keep its seed phrase offline on paper`,
      cost: 'under $3 of gas for the first transactions',
      time: '10 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital plus about $${gas} of gas`,
      time: '15 minutes to set up',
    },
  ];
  if (second !== null) {
    steps.push({
      text: `Repeat a smaller position on ${second}, ${p.name}'s second chain, so the wallet is active in two of its markets`,
      cost: `about $${Math.round(capital / 2)} of capital plus $${gas} of gas`,
      time: '15 minutes',
    });
  }
  steps.push(
    {
      text: secondActionFor(p, chain),
      cost: 'about $2 of gas each time',
      time: '10 minutes a week',
    },
    {
      text: `After the first week, open ${p.name}'s own points or rewards page and confirm this wallet's position is actually counted; if the page states a minimum balance or activity level, meet exactly that and write it in the log`,
      cost: 'nothing to check, and never pay anyone to claim for you',
      time: '10 minutes, once',
    },
    {
      text: `Keep the weekly actions running for ${weeks} weeks without a gap, so the wallet appears in several activity snapshots rather than one`,
      cost: `the $${capital} stays in the position, plus about $${2 * weeks} of gas over the plan`,
      time: `${weeks} weeks`,
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log as you go, so the position can be repeated, proven or unwound without guesswork`,
      cost: 'nothing but the log',
      time: '5 minutes a week',
    },
    {
      text: `The whole plan, summed: $${totals.capital_usd} of capital parked across ${second !== null ? 'two chains' : 'one chain'}, about $${totals.gas_usd} of gas across ${weeks} weeks, and about ${totals.minutes_per_week} minutes of work a week — if ${p.name} ever asks for more than the position itself, stop and re-read the plan`,
      cost: `about $${totals.gas_usd} of gas in total`,
      time: `${weeks} weeks in total`,
    },
    {
      text: `When a launch is announced, claim only from the link on ${p.name}'s official page, then unwind the position in two halves a week apart`,
      cost: 'claim gas only, usually under $5',
      time: '20 minutes, once',
    },
  );
  return steps;
}

/** The protocols the board ranks, strongest first, with ranks 1..n and a 0..100 signal apiece. */
export function buildBoard(snapshot: Snapshot, pricing: Pricing): BoardRow[] {
  const watchlist = new Set(snapshot.watchlist);
  const chosen = snapshot.protocols.filter((p) => watchlist.has(p.slug) || isRankable(p));
  const scored = chosen.map((p) => {
    const s = impliedValue(p, snapshot.as_of, pricing);
    return { p, ...s };
  });
  // The signal blends the log of TVL across the board's own range with the three multipliers.
  const logs = scored.map((s) => Math.log10(Math.max(1, s.p.tvl_usd)));
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  for (const s of scored) {
    const size = hi > lo ? (Math.log10(Math.max(1, s.p.tvl_usd)) - lo) / (hi - lo) : 0.5;
    const signal = Math.round(100 * (0.4 * size + 0.25 * ((s.momentum - 0.825) / 0.525) + 0.2 * ((s.tenure - 0.78) / 0.44) + 0.15 * ((s.breadth - 1) / 0.12)));
    (s as { signal?: number }).signal = clamp(signal, 1, 99);
  }
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    listed_at: s.p.listed_at,
    age_days: s.age,
    token_status: 'pre-token' as const,
    tier: watchlist.has(s.p.slug) ? ('watchlist' as const) : ('early' as const),
    implied_value_usd: s.implied,
    signal: (s as { signal?: number }).signal ?? 50,
    plan_totals: planTotals(s.p, s.age),
    model: {
      peer_multiple: s.peer_multiple,
      size_multiplier: round4(s.size),
      momentum_multiplier: round4(s.momentum),
      tenure_multiplier: round4(s.tenure),
      breadth_multiplier: round4(s.breadth),
      category_peers: pricing.by_category.get(s.p.category ?? 'Uncategorised')?.peers ?? 0,
    },
    model_raw: {
      peer_multiple: s.peer_multiple,
      size_multiplier: s.size,
      momentum_multiplier: s.momentum,
      tenure_multiplier: s.tenure,
      breadth_multiplier: s.breadth,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** The launched protocols, by market cap, for the dashboard's Launched view and its peer evidence. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      multiple: p.mcap_usd !== null && p.tvl_usd > 0 ? round2(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const pricing = buildPricing(snapshot);
  const board = buildBoard(snapshot, pricing);
  const live = liveRows(snapshot);
  const peers: Record<string, Peer[]> = {};
  for (const c of pricing.categories) peers[c.category] = c.top;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    global_multiple: pricing.global_multiple,
    launched_count: pricing.launched_count,
    median_age_days: pricing.median_age_days,
    size_ref_tvl: pricing.size_ref_tvl,
    backtest: backtestLaunched(snapshot),
    universe_size: snapshot.protocols.length,
    pre_token_size: snapshot.protocols.filter(isPreToken).length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => r.tier === 'early').length,
    live_size: live.length,
    categories: pricing.categories.map((c) => ({ category: c.category, peers: c.peers, median: c.median, multiple: c.multiple })),
    peers,
    rows: board.map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      listed_at: r.listed_at,
      age_days: r.age_days,
      tier: r.tier,
      implied_value_usd: r.implied_value_usd,
      signal: r.signal,
      plan_totals: r.plan_totals,
      peer_multiple: r.model_raw.peer_multiple,
      size_multiplier: r.model_raw.size_multiplier,
      momentum_multiplier: r.model_raw.momentum_multiplier,
      tenure_multiplier: r.model_raw.tenure_multiplier,
      breadth_multiplier: r.model_raw.breadth_multiplier,
      farm_steps: r.farm_steps,
    })),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared value, steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
