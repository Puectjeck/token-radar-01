// Deepfield Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a launched-peers view, the method behind the pricing, and a detail
// page per protocol with the model's own arithmetic and the protocol's farm plan. No network:
// every byte it shows is in data.js, and the page re-derives each implied value from the row's
// own multipliers and checks it against the board's figure before it calls the row verified.
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

  // The model in one function: the same arithmetic lib/model.ts runs, from the row's own figures.
  function impliedOf(row) {
    return Math.max(1, Math.round(row.tvl_usd * row.peer_multiple * row.momentum_multiplier * row.tenure_multiplier * row.breadth_multiplier));
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
    var s = { view: 'board', q: '', cat: 'all', chain: 'all', tier: 'all', sort: 'implied', slug: null };
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
        el('p', { class: 'tagline', text: 'Pre-token protocols priced off the multiples their launched peers actually trade at. Every protocol on the watchlist, every rankable one below it, each with the arithmetic shown and a farm plan with costs and times.' })),
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
      ['x momentum', 'the 7-day TVL change, winsorised'],
      ['x tenure', 'years tracked with no token'],
      ['x breadth', 'chains live'],
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
        el('td', { class: 'n' }, el('span', { class: 'nm', text: r.name }), el('span', { class: 'tier' + (r.tier === 'watchlist' ? ' w' : ''), text: r.tier === 'watchlist' ? 'watchlist' : 'early' }), el('div', { class: 'slug', text: r.slug })),
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
    var peerCount = catEntry ? catEntry.peers : 0;
    var verified = impliedOf(r) === r.implied_value_usd;
    var wf = [
      ['TVL (snapshot)', fmtUsd(r.tvl_usd), 'the protocol\u2019s own figure, sealed ' + DATA.as_of],
      ['x peer multiple', fmtMult(r.peer_multiple), 'median of ' + peerCount + ' launched ' + (r.category || 'Uncategorised') + (peerCount === 1 ? ' peer' : ' peers') + ', shrunk toward the universe median'],
      ['x momentum', fmtMult(r.momentum_multiplier), 'TVL change over 7 days: ' + fmtPct(r.change_7d) + ', winsorised to [-50%, +100%]'],
      ['x tenure', fmtMult(r.tenure_multiplier), 'tracked ' + fmtAge(r.age_days) + ' with no token recorded'],
      ['x breadth', fmtMult(r.breadth_multiplier), 'live on ' + r.chains.length + (r.chains.length === 1 ? ' chain' : ' chains')],
    ];
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
          el('div', { class: 'sub', text: (r.category || 'Uncategorised') + ' \u00b7 rank #' + r.rank + ' of ' + DATA.board_size + ' \u00b7 ' + (r.tier === 'watchlist' ? 'on the house watchlist' : 'found by the early radar below the floor') + ' \u00b7 signal ' + r.signal + '/100' })),
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
            el('dt', { text: 'Token' }), el('dd', { text: 'none recorded in the snapshot' })))),
      el('div', { class: 'cols' },
        el('div', { class: 'card' },
          el('h3', { text: 'The farm plan' }), plan),
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
        el('li', null, el('b', { text: 'Coverage. ' }), 'Every watchlist protocol is ranked, and the watchlist\u2019s own product test (no exchange products, no bridge or staking wrappers of launched tokens, no versioned pools) is applied to the whole universe to find the early rows below the $' + (DATA.floor_usd / 1e6) + 'M floor.'),
        el('li', null, el('b', { text: 'Peer multiple. ' }), 'For each category, the multiples of market cap to TVL of its launched protocols in this snapshot, winsorised to [x0.02, x5] and shrunk toward the universe median of x' + DATA.global_multiple.toFixed(3) + ' behind a prior worth four peers, so one lone peer never prices a whole category, clamped to [x0.04, x2]. No name is priced by hand.'),
        el('li', null, el('b', { text: 'Momentum. ' }), 'The 7-day TVL change, winsorised to [-50%, +100%], moves the price by up to +35% or -17.5%: growth into a launch is worth more, bleed is worth less.'),
        el('li', null, el('b', { text: 'Tenure. ' }), 'Years tracked with no token recorded scale the price from x0.78 to x1.22 across three years. An unknown age scores the pre-token universe\u2019s own median age, ' + DATA.median_age_days + ' days.'),
        el('li', null, el('b', { text: 'Breadth. ' }), 'Each chain past the first adds 3%, to +24%: distribution a launch inherits.'),
        el('li', null, el('b', { text: 'Signal. ' }), 'A 0-100 blend (size 40%, momentum 25%, tenure 20%, breadth 15%) for sorting a farmer\u2019s week. It never changes a rank: ranks are implied value alone.')),
      el('h3', { text: 'Category pricing table, computed from this snapshot' }),
      el('div', { class: 'scroll' }, el('table', { class: 'mini' },
        el('thead', null, el('tr', null, el('th', { class: 'n', text: 'Category' }), el('th', { text: 'Launched peers' }), el('th', { text: 'Median x TVL' }), el('th', { text: 'Multiple in force' }))),
        el('tbody', null, catRows))),
      el('p', { text: 'A category with no launched peer carrying both figures is priced at the universe median. Every figure on this page re-derives from the sealed snapshot of ' + DATA.as_of + '; rerun the program on a fresher snapshot and the board, the table and the prices move with it.' }));
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
      app.appendChild(boardTable());
    }
    app.appendChild(el('footer', null,
      el('span', { text: 'Board of ' + DATA.board_size + ' pre-token protocols: ' + DATA.watchlist_size + ' watchlist + ' + DATA.early_size + ' early. Implied values are this board\u2019s claims, not promises of a launch.' }),
      el('span', { class: 'r', text: 'model ' + DATA.model_version + ' \u00b7 snapshot ' + DATA.as_of })));
  }

  window.addEventListener('hashchange', function () { state = readHash(); render(); });
  render();
})();
