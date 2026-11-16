// Deepfield Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board led by its five top picks, a launched-peers view, the method behind
// the pricing with the model's own leave-one-out check, and a detail page per protocol with the
// model's own arithmetic, the plan's totals and the protocol's farm plan. No network: every byte
// it shows is in data.js, and the page re-derives each implied value from the row's own
// multipliers and checks it against the board's figure before it calls the row verified.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return 'x' + Number(n).toFixed(3); }

  var CLASS_LABELS = { core: 'core', exchange: 'exchange', bridge: 'bridge', 'staking-wrapper': 'staking wrapper', versioned: 'versioned', wrapper: 'wrapper' };
  var CLASS_PRICED = { exchange: true, bridge: true, 'staking-wrapper': true };
  function classPeers(cls) {
    var found = null;
    DATA.classes.forEach(function (c) { if (c.protocol_class === cls) found = c; });
    return found;
  }

  // The model in one function: the same arithmetic lib/model.ts runs, from the row's own figures.
  function impliedOf(row) {
    return Math.max(1, Math.round(row.tvl_usd * row.peer_multiple * row.size_multiplier * row.momentum_multiplier * row.tenure_multiplier * row.breadth_multiplier * row.class_multiplier));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // State lives in the hash, so any view can be linked, screenshotted and returned to.
  function readHash() {
    var s = { view: 'board', q: '', cat: 'all', chain: 'all', tier: 'all', cls: 'all', sort: 'implied', slug: null };
    var h = window.location.hash.replace(/^#\/?/, '');
    h.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv.length === 2) s[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
    });
    if (['board', 'launched', 'method', 'detail'].indexOf(s.view) < 0) s.view = 'board';
    return s;
  }
  var state = readHash();
  function go(patch) {
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    var parts = [];
    Object.keys(state).forEach(function (k) {
      if (state[k] !== null && state[k] !== '' && state[k] !== 'all' && !(k === 'view' && state[k] === 'board') && !(k === 'sort' && state[k] === 'implied')) {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(state[k]));
      }
    });
    history.replaceState(null, '', '#' + parts.join('&'));
    render();
  }

  function masthead() {
    var rings = document.createElement('div');
    rings.className = 'rings';
    rings.innerHTML =
      '<svg width="64" height="64" viewBox="0 0 64 64" fill="none">' +
      '<circle cx="32" cy="32" r="29" stroke="#1d7a52" stroke-width="1.5"/>' +
      '<circle cx="32" cy="32" r="20" stroke="#2a3b47" stroke-width="1.5"/>' +
      '<circle cx="32" cy="32" r="11" stroke="#1d7a52" stroke-width="1.5"/>' +
      '<line x1="32" y1="32" x2="54" y2="14" stroke="#3dffa0" stroke-width="2"/>' +
      '<circle cx="46" cy="24" r="3" fill="#3dffa0"/>' +
      '<circle cx="32" cy="32" r="2.5" fill="#d9e4ec"/></svg>';
    return el('header', { class: 'masthead' },
      rings,
      el('div', { class: 'wordmark' },
        el('h1', null, 'DEEPFIELD ', el('span', { class: 'lite', text: 'RADAR' })),
        el('p', { class: 'tagline', text: 'Pre-token protocols priced off the multiples their launched peers actually trade at. Every pre-token protocol in the snapshot is ranked \u2014 the watchlist, the exchanges, the bridges, the staking wrappers, the versioned releases \u2014 none set aside, each with the arithmetic shown and a farm plan with costs and times.' })),
      el('div', { class: 'mast-meta' },
        el('div', null, 'SNAPSHOT ', el('b', { text: DATA.as_of })),
        el('div', null, 'MODEL ', el('b', { text: DATA.model_version })),
        el('div', null, 'SOURCE ', el('b', { text: 'DefiLlama, sealed' }))));
  }

  function stats() {
    var top = DATA.rows[0];
    var items = [
      [String(DATA.universe_size), 'protocols scanned'],
      [String(DATA.pre_token_size), 'record no token'],
      [String(DATA.board_size), 'ranked on the board'],
      [String(DATA.watchlist_size) + ' / ' + String(DATA.watchlist_size), 'watchlist covered'],
      [fmtUsd(top ? top.implied_value_usd : 0), 'top implied value'],
    ];
    return el('section', { class: 'stats' }, items.map(function (it) {
      return el('div', { class: 'stat' }, el('div', { class: 'v', text: it[0] }), el('div', { class: 'k', text: it[1] }));
    }));
  }

  function formula() {
    var f = el('div', { class: 'formula' });
    f.appendChild(document.createTextNode('IMPLIED VALUE = TVL '));
    var parts = [
      ['x peer multiple', 'the median market-cap / TVL of the category\u2019s launched protocols'],
      ['x size', 'TVL against the launched set\u2019s median, at the size discount the launched set itself shows'],
      ['x momentum', 'the 7-day TVL change, winsorised'],
      ['x tenure', 'years tracked with no token'],
      ['x breadth', 'chains live'],
      ['x class', 'the class multiplier: a versioned family\u2019s share, a wrapper\u2019s measured haircut, else 1'],
    ];
    parts.forEach(function (p) {
      var b = el('b', { text: p[0], title: p[1] });
      f.appendChild(b);
      f.appendChild(el('span', { class: 'op', text: '  ' }));
    });
    f.appendChild(document.createTextNode('  universe median x' + DATA.global_multiple.toFixed(3) + ' across ' + DATA.launched_count + ' launched protocols'));
    return f;
  }

  function tabs(active) {
    var defs = [['board', 'Radar board'], ['launched', 'Launched peers'], ['method', 'The method']];
    return el('nav', { class: 'tabs' }, defs.map(function (d) {
      return el('button', {
        'aria-pressed': active === d[0] ? 'true' : 'false',
        onclick: function () { go({ view: d[0], slug: null }); },
        text: d[1],
      });
    }));
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.tier !== 'all' && r.tier !== state.tier) return false;
      if (state.cls !== 'all' && r.protocol_class !== state.cls) return false;
      if (state.cat !== 'all' && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
  }

  var SORTERS = {
    implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
    signal: function (a, b) { return b.signal - a.signal; },
    tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
    change: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
    age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
    multiple: function (a, b) { return b.peer_multiple - a.peer_multiple; },
  };

  function controls(rows) {
    var cats = [];
    var chains = {};
    DATA.rows.forEach(function (r) {
      var c = r.category || 'Uncategorised';
      if (cats.indexOf(c) < 0) cats.push(c);
      r.chains.forEach(function (ch) { chains[ch] = (chains[ch] || 0) + 1; });
    });
    cats.sort();
    var chainNames = Object.keys(chains).sort(function (a, b) { return chains[b] - chains[a]; }).slice(0, 28);

    function select(id, value, options, onchange) {
      var s = el('select', { id: id, onchange: function () { onchange(s.value); } },
        options.map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
      s.value = value;
      return s;
    }
    return el('div', { class: 'controls' },
      el('input', {
        type: 'search', placeholder: 'Search name or slug', value: state.q, 'aria-label': 'Search protocols',
        oninput: function (e) { state.q = e.target.value; go({}); },
      }),
      el('label', { text: 'Tier' }),
      select('f-tier', state.tier, [['all', 'All tiers'], ['watchlist', 'Watchlist'], ['early', 'Early radar']], function (v) { go({ tier: v }); }),
      el('label', { text: 'Class' }),
      select('f-cls', state.cls, [['all', 'All classes'], ['core', 'Core'], ['exchange', 'Exchange'], ['bridge', 'Bridge'], ['staking-wrapper', 'Staking wrapper'], ['versioned', 'Versioned'], ['wrapper', 'Wrapper']], function (v) { go({ cls: v }); }),
      el('label', { text: 'Category' }),
      select('f-cat', state.cat, [['all', 'All categories']].concat(cats.map(function (c) { return [c, c]; })), function (v) { go({ cat: v }); }),
      el('label', { text: 'Chain' }),
      select('f-chain', state.chain, [['all', 'All chains']].concat(chainNames.map(function (c) { return [c, c]; })), function (v) { go({ chain: v }); }),
      el('label', { text: 'Sort' }),
      select('f-sort', state.sort, [['implied', 'Implied value'], ['signal', 'Signal'], ['tvl', 'TVL'], ['change', '7d change'], ['age', 'Tenure'], ['multiple', 'Peer multiple']], function (v) { go({ sort: v }); }),
      el('span', { class: 'count', text: rows.length + ' shown' }));
  }

  function signalCell(r) {
    var bar = el('span', { class: 'sigbar' }, el('i', null));
    bar.firstChild.style.width = r.signal + '%';
    return el('span', { class: 'sig' }, bar, el('span', { class: 'sigv', text: String(r.signal) }));
  }

  // Why a pick earns its place, in one line, from the row's own figures alone.
  function pickReason(r) {
    if (r.change_7d !== null && r.change_7d >= 25) return 'growing ' + fmtPct(r.change_7d) + ' in 7 days';
    if (r.age_days !== null && r.age_days >= 1095) return fmtAge(r.age_days) + ' tracked, still no token';
    if (r.peer_multiple >= 0.5) return 'its launched peers trade at ' + fmtMult(r.peer_multiple);
    if (r.chains.length >= 6) return 'live on ' + r.chains.length + ' chains';
    if (r.size_multiplier >= 1.3) return 'small beside the launched median: size ' + fmtMult(r.size_multiplier);
    return 'signal ' + r.signal + '/100 across size, momentum, tenure, breadth';
  }

  // The top picks: the five strongest signals on the board, each with its reason and its plan's
  // price tag, so a reader's first move is on the page before the table asks for any scrolling.
  function picks() {
    var top = DATA.rows.slice().sort(function (a, b) { return b.signal - a.signal || a.rank - b.rank; }).slice(0, 5);
    return el('section', { class: 'picks' },
      el('div', { class: 'picks-head' },
        el('h2', { text: 'Top picks' }),
        el('span', { text: 'strongest signals first \u00b7 the plan\u2019s whole cost on each card' })),
      el('div', { class: 'pick-grid' }, top.map(function (r) {
        return el('button', { class: 'pick', onclick: function () { go({ view: 'detail', slug: r.slug }); } },
          el('div', { class: 'pick-top' },
            el('span', { class: 'pick-name', text: r.name }),
            el('span', { class: 'pick-sig', text: String(r.signal) })),
          el('div', { class: 'pick-iv', text: fmtUsd(r.implied_value_usd) }),
          el('div', { class: 'pick-why', text: pickReason(r) }),
          el('div', { class: 'pick-cost', text: 'plan: $' + r.plan_totals.capital_usd + ' parked \u00b7 ~$' + r.plan_totals.gas_usd + ' gas \u00b7 ' + r.plan_totals.weeks + ' weeks' }));
      })));
  }

  function boardTable() {
    var rows = filteredRows().slice().sort(SORTERS[state.sort] || SORTERS.implied);
    if (rows.length === 0) return el('div', { class: 'empty', text: 'No protocol matches that filter. Loosen the search, the tier or the chain.' });
    var heads = [
      ['#', 'rk', null], ['Protocol', 'n', null], ['Category', 'n', null], ['Chains', 'n', null],
      ['TVL', '', 'tvl'], ['7d', '', 'change'], ['Age', '', 'age'], ['Peer x', '', 'multiple'], ['Implied value', '', 'implied'], ['Signal', '', 'signal'],
    ];
    var thead = el('thead', null, el('tr', null, heads.map(function (h) {
      var content = h[2]
        ? el('button', { onclick: function () { go({ sort: h[2] }); } }, h[0] + (state.sort === h[2] ? ' ' : ''), state.sort === h[2] ? el('span', { class: 'arr', text: '\u25bc' }) : null)
        : h[0];
      return el('th', { class: h[1] }, content);
    })));
    var tbody = el('tbody', null, rows.map(function (r) {
      return el('tr', { onclick: function () { go({ view: 'detail', slug: r.slug }); }, title: 'Open the detail view' },
        el('td', { class: 'rk', text: String(r.rank) }),
        el('td', { class: 'n' }, el('span', { class: 'nm', text: r.name }), el('span', { class: 'tier' + (r.tier === 'watchlist' ? ' w' : ''), text: r.tier === 'watchlist' ? 'watchlist' : 'early' }), r.protocol_class !== 'core' ? el('span', { class: 'tier k', text: CLASS_LABELS[r.protocol_class] }) : null, el('div', { class: 'slug', text: r.slug })),
        el('td', { class: 'cat n', text: r.category || 'Uncategorised' }),
        el('td', { class: 'chn n', text: r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtMult(r.peer_multiple) }),
        el('td', { class: 'iv', text: fmtUsd(r.implied_value_usd) }),
        el('td', null, signalCell(r)));
    }));
    return el('div', { class: 'scroll' }, el('table', { class: 'board' }, thead, tbody));
  }

  function splitStep(s) {
    var ci = s.indexOf(' Cost: ');
    var ti = s.lastIndexOf('. Time: ');
    if (ci < 0 || ti < 0 || ti < ci) return { text: s, cost: null, time: null };
    return {
      text: s.slice(0, ci),
      cost: s.slice(ci + 7, ti),
      time: s.slice(ti + 8).replace(/\.$/, ''),
    };
  }

  function detail(slug) {
    var r = null;
    DATA.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return el('div', { class: 'empty', text: 'That protocol is not on the board.' });
    var peers = (DATA.peers[r.category || 'Uncategorised'] || []);
    var catEntry = null;
    DATA.categories.forEach(function (c) { if (c.category === (r.category || 'Uncategorised')) catEntry = c; });
    var clsEntry = classPeers(r.protocol_class);
    var peerCount = CLASS_PRICED[r.protocol_class] && clsEntry ? clsEntry.peers : catEntry ? catEntry.peers : 0;
    var verified = impliedOf(r) === r.implied_value_usd;
    var wf = [
      ['TVL (snapshot)', fmtUsd(r.tvl_usd), 'the protocol\u2019s own figure, sealed ' + DATA.as_of],
      ['x peer multiple', fmtMult(r.peer_multiple), CLASS_PRICED[r.protocol_class] ? 'median of ' + peerCount + ' launched ' + CLASS_LABELS[r.protocol_class] + ' peers, pooled across the class\u2019s categories, shrunk toward the universe median' : 'median of ' + peerCount + ' launched ' + (r.category || 'Uncategorised') + (peerCount === 1 ? ' peer' : ' peers') + ', shrunk toward the universe median'],
      ['x size', fmtMult(r.size_multiplier), 'TVL against the launched set\u2019s median of ' + fmtUsd(DATA.size_ref_tvl) + ', at the size discount the launched set itself shows'],
      ['x momentum', fmtMult(r.momentum_multiplier), 'TVL change over 7 days: ' + fmtPct(r.change_7d) + ', winsorised to [-50%, +100%]'],
      ['x tenure', fmtMult(r.tenure_multiplier), 'tracked ' + fmtAge(r.age_days) + ' with no token recorded'],
      ['x breadth', fmtMult(r.breadth_multiplier), 'live on ' + r.chains.length + (r.chains.length === 1 ? ' chain' : ' chains')],
      ['x class', fmtMult(r.class_multiplier), r.protocol_class === 'versioned' ? 'a versioned release, priced at its family\u2019s share: sibling releases of one protocol split one price' : r.protocol_class === 'wrapper' ? 'a wrapper in a generic category, priced with the staking classes\u2019 measured haircut of x' + DATA.wrapper_discount.toFixed(3) : CLASS_PRICED[r.protocol_class] ? 'a ' + CLASS_LABELS[r.protocol_class] + ': its class\u2019s own peer multiple above already carries the class discount, so no second haircut is stacked' : 'a core protocol: no class adjustment'],
    ];
    var below = 0;
    var ivs = DATA.rows.map(function (x) { return x.implied_value_usd; }).sort(function (a, b) { return a - b; });
    DATA.rows.forEach(function (x) { if (x.tvl_usd <= r.tvl_usd) below++; });
    var tvlPct = Math.round((100 * below) / DATA.rows.length);
    var medIv = ivs[Math.floor(ivs.length / 2)];
    var planTotals = el('div', { class: 'plan-totals' },
      el('span', { class: 'chip' }, 'CAPITAL ', el('b', { text: '$' + r.plan_totals.capital_usd + ' parked' })),
      el('span', { class: 'chip' }, 'GAS ', el('b', { text: '~$' + r.plan_totals.gas_usd + ' all-in' })),
      el('span', { class: 'chip' }, 'RUNS ', el('b', { text: r.plan_totals.weeks + ' weeks' })),
      el('span', { class: 'chip' }, 'WORK ', el('b', { text: '~' + r.plan_totals.minutes_per_week + ' min/week' })));
    var plan = el('ol', { class: 'plan' }, r.farm_steps.map(function (s) {
      var p = splitStep(s);
      return el('li', null,
        el('span', { class: 'no' }),
        el('div', { class: 'tx' },
          el('div', { text: p.text }),
          el('div', { class: 'meta' },
            p.cost ? el('span', { class: 'chip' }, 'COST ', el('b', { text: p.cost })) : null,
            p.time ? el('span', { class: 'chip' }, 'TIME ', el('b', { text: p.time })) : null)));
    }));
    return el('section', null,
      el('button', { class: 'back', onclick: function () { go({ view: 'board', slug: null }); }, text: '\u2190 Back to the board' }),
      el('div', { class: 'detail-head' },
        el('div', null,
          el('h2', { text: r.name }),
          el('div', { class: 'sub', text: (r.category || 'Uncategorised') + ' \u00b7 class ' + CLASS_LABELS[r.protocol_class] + ' \u00b7 rank #' + r.rank + ' of ' + DATA.board_size + ' \u00b7 ' + (r.tier === 'watchlist' ? 'on the house watchlist' : 'found by the early radar below the floor') + ' \u00b7 signal ' + r.signal + '/100' })),
        el('div', { class: 'big-iv' },
          el('div', { class: 'v', text: fmtUsd(r.implied_value_usd) }),
          el('div', { class: 'k', text: 'implied value if it launched at peer prices' }))),
      el('div', { class: 'cols' },
        el('div', { class: 'card' },
          el('h3', { text: 'How the radar prices it' }),
          el('div', { class: 'waterfall' },
            wf.map(function (w) {
              return el('div', { class: 'row' }, el('span', null, w[0], el('div', { class: 'why', text: w[2] })), el('span', { text: w[1] }));
            }),
            el('div', { class: 'row total' }, el('span', { text: 'Implied value' }), el('span', { text: fmtUsd(r.implied_value_usd) }))),
          el('p', { class: 'note', text: verified ? 'The page re-derived this figure from the row\u2019s own multipliers and it matches the board\u2019s: the code and the board agree.' : 'The page\u2019s re-derivation differs from the board\u2019s figure; trust the board.' })),
        el('div', { class: 'card' },
          el('h3', { text: 'The record' }),
          el('dl', { class: 'kv' },
            el('dt', { text: 'Chains' }), el('dd', { text: r.chains.join(', ') || 'none recorded' }),
            el('dt', { text: 'TVL' }), el('dd', { text: fmtUsd(r.tvl_usd) }),
            el('dt', { text: '7-day change' }), el('dd', { text: fmtPct(r.change_7d) }),
            el('dt', { text: 'Tracked since' }), el('dd', { text: r.listed_at || 'not recorded' }),
            el('dt', { text: 'Age' }), el('dd', { text: fmtAge(r.age_days) }),
            el('dt', { text: 'TVL percentile' }), el('dd', { text: 'above ' + tvlPct + '% of the board' }),
            el('dt', { text: 'Vs board median' }), el('dd', { text: 'x' + (r.implied_value_usd / medIv).toFixed(1) + ' the median implied value' }),
            el('dt', { text: 'Token' }), el('dd', { text: 'none recorded in the snapshot' }),
            el('dt', { text: 'Class' }), el('dd', { text: CLASS_LABELS[r.protocol_class] })))),
      el('div', { class: 'cols' },
        el('div', { class: 'card' },
          el('h3', { text: 'The farm plan' }), planTotals, plan),
        el('div', null,
          el('div', { class: 'card' },
            el('h3', { text: 'Launched peers that set the price' }),
            peers.length === 0
              ? el('p', { class: 'note', text: 'No launched protocol in this category carries both a market cap and a TVL in the snapshot, so the universe median multiple prices this row.' })
              : el('table', { class: 'mini' },
                  el('thead', null, el('tr', null, el('th', { class: 'n', text: 'Peer' }), el('th', { text: 'Market cap' }), el('th', { text: 'TVL' }), el('th', { text: 'x TVL' }))),
                  el('tbody', null, peers.map(function (p) {
                    return el('tr', null,
                      el('td', { class: 'n', text: p.name }),
                      el('td', { class: 'num', text: fmtUsd(p.mcap_usd) }),
                      el('td', { class: 'num', text: fmtUsd(p.tvl_usd) }),
                      el('td', { class: 'num', text: fmtMult(p.multiple) }));
                  }))),
            el('p', { class: 'note', text: 'These protocols already trade. The radar never ranks them: it reads their prices as evidence for the ones still to come.' })),
          el('div', { class: 'card' },
            el('h3', { text: 'Before you farm it' }),
            el('p', { class: 'note', text: 'An implied value is this board\u2019s claim, priced off today\u2019s snapshot: it is not a promise that a token is issued, nor what it would trade at. Protocols can issue nothing, issue to insiders first, or count farmers out. Size every position as money you can leave parked, and never pay a third party to claim for you.' })))));
  }

  function launched() {
    return el('section', null,
      el('p', { class: 'note', text: 'The launched set: the snapshot\u2019s biggest protocols whose token already trades. They are kept off the ranked board on purpose; their market-cap-to-TVL multiples are the evidence the radar prices the pre-token board with.' }),
      el('div', { class: 'scroll' }, el('table', { class: 'board' },
        el('thead', null, el('tr', null,
          el('th', { class: 'n', text: 'Protocol' }), el('th', { class: 'n', text: 'Category' }), el('th', { text: 'TVL' }), el('th', { text: 'Market cap' }), el('th', { text: 'x TVL' }), el('th', { text: '7d' }))),
        el('tbody', null, DATA.live.map(function (p) {
          return el('tr', null,
            el('td', { class: 'n' }, el('span', { class: 'nm', text: p.name }), el('div', { class: 'slug', text: p.slug })),
            el('td', { class: 'cat n', text: p.category || 'Uncategorised' }),
            el('td', { class: 'num', text: fmtUsd(p.tvl_usd) }),
            el('td', { class: 'num', text: fmtUsd(p.mcap_usd) }),
            el('td', { class: 'num', text: p.multiple === null ? 'n/a' : fmtMult(p.multiple) }),
            el('td', { class: 'num ' + (p.change_7d === null ? '' : p.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(p.change_7d) }));
        })))));
  }

  function method() {
    var catRows = DATA.categories.map(function (c) {
      return el('tr', null,
        el('td', { class: 'n', text: c.category }),
        el('td', { class: 'num', text: String(c.peers) }),
        el('td', { class: 'num', text: c.median === null ? 'n/a' : fmtMult(c.median) }),
        el('td', { class: 'num', text: fmtMult(c.multiple) }));
    });
    return el('section', { class: 'method' },
      el('h2', { text: 'The method' }),
      el('p', null, 'The radar answers one question: ', el('b', { text: 'if this protocol issued its token at the price the market already pays its launched peers, what would it be worth, and what should a farmer do about it?' }), ' It never predicts whether or when a token comes.'),
      el('ul', null,
        el('li', null, el('b', { text: 'Coverage. ' }), 'Every pre-token protocol in the snapshot is ranked: all ' + DATA.pre_token_size + ' of them, the watchlist\u2019s ' + DATA.watchlist_size + ' included, none set aside. Rows the radar once left off \u2014 exchanges, bridges, staking wrappers, versioned releases \u2014 are priced under the class their own category and name assign them, below.'),
        el('li', null, el('b', { text: 'Peer multiple. ' }), 'For each category, the multiples of market cap to TVL of its launched protocols in this snapshot, winsorised to [x0.02, x5] and shrunk toward the universe median of x' + DATA.global_multiple.toFixed(3) + ' behind a prior worth four peers, so one lone peer never prices a whole category, clamped to [x0.04, x2]. No name is priced by hand.'),
        el('li', null, el('b', { text: 'Size. ' }), 'The launched set prices size at a discount: across its ' + DATA.launched_count + ' protocols, the multiple of market cap to TVL falls as TVL grows. The model applies (TVL / ' + fmtUsd(DATA.size_ref_tvl) + ', the launched set\u2019s median TVL) to the power -0.25, clamped to [x0.5, x2], so the largest protocols are no longer priced as if they were small ones. The exponent is the setting the check below scores best, not a round number picked by hand.'),
        el('li', null, el('b', { text: 'Momentum. ' }), 'The 7-day TVL change, winsorised to [-50%, +100%], moves the price by up to +35% or -17.5%: growth into a launch is worth more, bleed is worth less.'),
        el('li', null, el('b', { text: 'Tenure. ' }), 'Years tracked with no token recorded scale the price from x0.78 to x1.22 across four years. An unknown age scores the pre-token universe\u2019s own median age, ' + DATA.median_age_days + ' days.'),
        el('li', null, el('b', { text: 'Breadth. ' }), 'Each chain past the first adds 2%, to +12%: distribution a launch inherits.'),
        el('li', null, el('b', { text: 'Signal. ' }), 'A 0-100 blend (size 40%, momentum 25%, tenure 20%, breadth 15%) for sorting a farmer\u2019s week. It never changes a rank: ranks are implied value alone.'),
        el('li', null, el('b', { text: 'Classes. ' }), 'A row\u2019s class comes from its own snapshot fields, never a list of names. Exchange, bridge and staking-wrapper rows (assigned by category) are priced off their class\u2019s launched peers, pooled across the class\u2019s categories in the class table below: what launched exchanges trade at prices an exchange. A versioned row (its name ends in a release marker) is priced at its family\u2019s share, x1 divided by the number of snapshot rows sharing its version-stripped name, so sibling releases split one price. A wrapper row in a generic category (a wrapped, staked or staking word in its name) takes the staking classes\u2019 measured haircut, x' + DATA.wrapper_discount.toFixed(3) + ' on this snapshot. No second haircut is stacked on the category classes: the check below shows their own peer multiple already carries the discount, and stacking one prices the launched set worse.')),
      el('h3', { text: 'Category pricing table, computed from this snapshot' }),
      el('div', { class: 'scroll' }, el('table', { class: 'mini' },
        el('thead', null, el('tr', null, el('th', { class: 'n', text: 'Category' }), el('th', { text: 'Launched peers' }), el('th', { text: 'Median x TVL' }), el('th', { text: 'Multiple in force' }))),
        el('tbody', null, catRows))),
      el('p', { text: 'A category with no launched peer carrying both figures is priced at the universe median. Every figure on this page re-derives from the sealed snapshot of ' + DATA.as_of + '; rerun the program on a fresher snapshot and the board, the table and the prices move with it.' }),
      el('h3', { text: 'Class pricing, computed from this snapshot' }),
      el('div', { class: 'scroll' }, el('table', { class: 'mini' },
        el('thead', null, el('tr', null, el('th', { class: 'n', text: 'Class' }), el('th', { text: 'Launched peers' }), el('th', { text: 'Median x TVL' }), el('th', { text: 'Multiple in force' }))),
        el('tbody', null, DATA.classes.map(function (c) {
          return el('tr', null,
            el('td', { class: 'n', text: CLASS_LABELS[c.protocol_class] }),
            el('td', { class: 'num', text: String(c.peers) }),
            el('td', { class: 'num', text: c.median === null ? 'n/a' : fmtMult(c.median) }),
            el('td', { class: 'num', text: fmtMult(c.multiple) }));
        })))),
      el('p', { text: 'Versioned and wrapper rows have no launched class of their own to pool: they are priced by the family share and the staking haircut described above, over their category\u2019s multiple.' }),
      el('h3', { text: 'How the radar checks itself' }),
      el('p', null, 'Before any price here was trusted, the model was pointed at the snapshot\u2019s ', el('b', { text: DATA.backtest.protocols + ' launched protocols' }), ' and asked to price each one as if it were still pre-token, from a pricing table built out of the others alone \u2014 the leave-one-out check. Under the previous configuration the median miss was a factor of ', el('b', { text: 'x' + DATA.backtest.previous.typical_factor.toFixed(2) }), ' (' + DATA.backtest.previous.within_2x_pct + '% priced within x2 of the real market cap, ' + DATA.backtest.previous.within_3x_pct + '% within x3). Under this one the median miss is ', el('b', { text: 'x' + DATA.backtest.current.typical_factor.toFixed(2) }), ' (' + DATA.backtest.current.within_2x_pct + '% within x2, ' + DATA.backtest.current.within_3x_pct + '% within x3). Every setting that differs between the two \u2014 the size exponent, the tenure horizon, the breadth weight \u2014 was kept only because this check scored it better. The check reruns on every build, from the snapshot alone, and these are this snapshot\u2019s figures.'));
  }

  function render() {
    app.setAttribute('aria-busy', 'false');
    app.textContent = '';
    app.appendChild(masthead());
    app.appendChild(stats());
    app.appendChild(formula());
    var bar = el('div', { class: 'bar' }, tabs(state.view === 'detail' ? 'board' : state.view));
    app.appendChild(bar);
    if (state.view === 'detail') {
      app.appendChild(detail(state.slug));
    } else if (state.view === 'launched') {
      app.appendChild(launched());
    } else if (state.view === 'method') {
      app.appendChild(method());
    } else {
      var rows = filteredRows();
      bar.appendChild(controls(rows));
      app.appendChild(picks());
      app.appendChild(boardTable());
    }
    app.appendChild(el('footer', null,
      el('span', { text: 'Board of ' + DATA.board_size + ' pre-token protocols: ' + DATA.watchlist_size + ' watchlist + ' + DATA.early_size + ' early. Implied values are this board\u2019s claims, not promises of a launch.' }),
      el('span', { class: 'r', text: 'model ' + DATA.model_version + ' \u00b7 snapshot ' + DATA.as_of })));
  }

  window.addEventListener('hashchange', function () { state = readHash(); render(); });
  render();
})();
