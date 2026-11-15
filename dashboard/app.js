/* Token Radar dashboard: renders window.RADAR with no network.
 *
 * Views are hash-driven so each one has a shareable address:
 *   #tab=board | live | method
 *   #detail=<slug>        a protocol's detail card above the board
 *   #cat=<category>       the board filtered to one category
 *   #watchlist=1          the board filtered to the watchlist only
 *   #q=<text>             the board searched for a name
 * Sort by any column header; filter by text, category, chain or tier.
 */
(function () {
  'use strict';
  var D = window.RADAR;
  var root = document.getElementById('app');

  /* ---------- formatting ---------- */
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function moneyFull(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(v) {
    if (v === null || v === undefined) return '<span class="flat">—</span>';
    var cls = v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat';
    var sign = v > 0 ? '+' : '';
    return '<span class="' + cls + '">' + sign + v.toFixed(1) + '%</span>';
  }
  function age(v) {
    if (v === null || v === undefined) return '<span class="flat">—</span>';
    if (v < 30) return v + 'd';
    if (v < 365) return Math.round(v / 30) + 'mo';
    return (v / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function tierBadge(t) {
    var cls = t === 'Prime' ? 'prime' : t === 'Strong' ? 'strong' : t === 'Watch' ? 'watch2' : 'early';
    return '<span class="badge ' + cls + '">' + t + '</span>';
  }
  function chainsShort(chains) {
    if (!chains || chains.length === 0) return '—';
    if (chains.length <= 2) return esc(chains.join(', '));
    return esc(chains[0]) + ' +' + (chains.length - 1);
  }

  /* ---------- state ---------- */
  var state = { tab: 'board', q: '', cat: '', chain: '', tier: '', watch: false, sort: 'rank', dir: 1, detail: null };

  function readHash() {
    var h = (location.hash || '').replace(/^#/, '');
    var parts = h ? h.split('&') : [];
    var next = { tab: 'board', q: '', cat: '', chain: '', tier: '', watch: false, sort: 'rank', dir: 1, detail: null };
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      var k = kv[0], v = kv[1] ? decodeURIComponent(kv[1].replace(/\+/g, ' ')) : '';
      if (k === 'tab' && (v === 'board' || v === 'live' || v === 'method')) next.tab = v;
      else if (k === 'q') next.q = v;
      else if (k === 'cat') next.cat = v;
      else if (k === 'chain') next.chain = v;
      else if (k === 'tier') next.tier = v;
      else if (k === 'watchlist') next.watch = v === '1';
      else if (k === 'detail') next.detail = v;
    }
    state = next;
  }
  function writeHash() {
    var bits = [];
    if (state.tab !== 'board') bits.push('tab=' + state.tab);
    if (state.q) bits.push('q=' + encodeURIComponent(state.q));
    if (state.cat) bits.push('cat=' + encodeURIComponent(state.cat));
    if (state.chain) bits.push('chain=' + encodeURIComponent(state.chain));
    if (state.tier) bits.push('tier=' + encodeURIComponent(state.tier));
    if (state.watch) bits.push('watchlist=1');
    if (state.detail) bits.push('detail=' + encodeURIComponent(state.detail));
    var h = bits.join('&');
    if (('#' + h) !== location.hash) history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
  }

  /* ---------- filtering & sorting ---------- */
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      if (state.tier && r.tier !== state.tier) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort, dir = state.dir;
    rows.sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string') return dir * (av < bv ? -1 : av > bv ? 1 : 0);
      return dir * (av - bv);
    });
    return rows;
  }

  function sortArrow(key) {
    if (state.sort !== key) return '';
    return state.dir === 1 ? ' ▲' : ' ▼';
  }
  function th(key, label, num) {
    return '<th class="' + (num ? 'num' : '') + '"><button data-sort="' + key + '">' + label + sortArrow(key) + '</button></th>';
  }

  /* ---------- detail card ---------- */
  function detailHtml(r) {
    var boardRow = null;
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === r.slug) boardRow = D.rows[i];
    var steps = (D.steps && D.steps[r.slug]) || [];
    var mult = r.peer_multiple;
    var peerNote = r.peer_count >= 3
      ? r.peer_count + ' live peers in ' + esc(r.category || 'this category') + ', median ×' + mult.toFixed(3) + ' after shrinkage toward the global median.'
      : 'Fewer than 3 live peers in this category, so the global median multiple ×' + mult.toFixed(3) + ' is used.';
    var formula = money(r.tvl_usd) + ' TVL × <b>×' + r.peer_multiple.toFixed(3) + '</b> peer × <b>×' + r.growth_multiplier.toFixed(2) + '</b> growth × <b>×' +
      r.maturity_multiplier.toFixed(2) + '</b> maturity × <b>×' + r.chain_multiplier.toFixed(2) + '</b> chains = <b>' + moneyFull(r.implied_value_usd) + '</b>';
    var stepsHtml = steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    return '' +
      '<section class="detail" id="detail-card" aria-label="Protocol detail">' +
      '<button class="close" data-close-detail="1">Close ✕</button>' +
      '<div class="crumb">Rank #' + r.rank + ' of ' + D.rows.length + ' · ' + (r.watchlist ? 'On the watchlist · ' : '') + esc(r.category || 'Uncategorised') + '</div>' +
      '<h2>' + esc(r.name) + tierBadge(r.tier) + '</h2>' +
      '<p class="tagline">DefiLlama records no token for this protocol. That is the record, not proof it has none — ' +
      'a launch here is the entry\'s own claim, priced from the snapshot\'s figures below.</p>' +
      '<div class="dgrid">' +
      '<div class="cell"><div class="k">Implied launch value</div><div class="v">' + moneyFull(r.implied_value_usd) + '</div></div>' +
      '<div class="cell"><div class="k">TVL</div><div class="v">' + money(r.tvl_usd) + '</div></div>' +
      '<div class="cell"><div class="k">7-day TVL change</div><div class="v">' + pct(r.change_7d) + '</div></div>' +
      '<div class="cell"><div class="k">Tracked since</div><div class="v">' + (r.listed_at ? esc(r.listed_at) : '—') + ' <small>(' + age(r.age_days) + ')</small></div></div>' +
      '<div class="cell"><div class="k">Chains</div><div class="v">' + r.chains.length + ' <small>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? '…' : '') + '</small></div></div>' +
      '<div class="cell"><div class="k">Category peer multiple</div><div class="v">×' + r.peer_multiple.toFixed(3) + '</div></div>' +
      '</div>' +
      '<div class="formula">' + formula +
      '<span class="note">' + esc(peerNote) + ' Growth is the 7-day TVL change clamped to −50%…+100% and weighted 0.6. ' +
      'Maturity rises with days tracked, to 1.20 at 3 years. Each extra chain adds 2%, to 1.20.</span></div>' +
      '<h3>How to farm it — 6 steps</h3>' +
      '<ol class="steps">' + stepsHtml + '</ol>' +
      '</section>';
  }

  /* ---------- views ---------- */
  function boardHtml() {
    var rows = filteredRows();
    var cats = {}, chains = {};
    D.rows.forEach(function (r) { if (r.category) cats[r.category] = 1; (r.chains || []).forEach(function (c) { chains[c] = 1; }); });
    var catOpts = ['<option value="">All categories</option>'].concat(Object.keys(cats).sort().map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    })).join('');
    var chainOpts = ['<option value="">All chains</option>'].concat(Object.keys(chains).sort().map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    })).join('');
    var tierOpts = ['<option value="">All tiers</option>'].concat(['Prime', 'Strong', 'Watch', 'Early'].map(function (t) {
      return '<option value="' + t + '"' + (state.tier === t ? ' selected' : '') + '>' + t + '</option>';
    })).join('');
    var detail = null;
    if (state.detail) {
      for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === state.detail) detail = D.rows[i];
    }
    var body = rows.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (detail && detail.slug === r.slug ? ' class="sel"' : '') + '>' +
        '<td class="rank">#' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + tierBadge(r.tier) + '</span><span class="sub">' + esc(r.slug) + (r.watchlist ? ' · watchlist' : '') + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + chainsShort(r.chains) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num big">' + money(r.implied_value_usd) + '</td>' +
        '<td class="num">×' + r.peer_multiple.toFixed(2) + '</td>' +
        '</tr>';
    }).join('');
    return '' +
      '<div class="filters" role="search">' +
      '<label>Search <input type="search" id="f-q" placeholder="Protocol name…" value="' + esc(state.q) + '"></label>' +
      '<label>Category <select id="f-cat">' + catOpts + '</select></label>' +
      '<label>Chain <select id="f-chain">' + chainOpts + '</select></label>' +
      '<label>Tier <select id="f-tier">' + tierOpts + '</select></label>' +
      '<label class="check"><input type="checkbox" id="f-watch"' + (state.watch ? ' checked' : '') + '> Watchlist only</label>' +
      '<span class="count"><b>' + rows.length + '</b> of ' + D.rows.length + ' protocols</span>' +
      '</div>' +
      (detail ? detailHtml(detail) : '') +
      '<table><thead><tr>' +
      th('rank', '#', false) + th('name', 'Protocol', false) + th('category', 'Category', false) + '<th>Chains</th>' +
      th('tvl_usd', 'TVL', true) + th('change_7d', '7d', true) + th('age_days', 'Age', true) +
      th('implied_value_usd', 'Implied value', true) + th('peer_multiple', 'Peer ×', true) +
      '</tr></thead><tbody>' +
      (body || '<tr><td colspan="9" class="empty">No protocol matches these filters.</td></tr>') +
      '</tbody></table>';
  }

  function liveHtml() {
    var body = D.live.map(function (p) {
      var ratio = p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) : '—';
      return '<tr><td><span class="name">' + esc(p.name) + '</span><span class="sub">' + esc(p.slug) + '</span></td>' +
        '<td>' + esc(p.category || '—') + '</td>' +
        '<td>' + chainsShort(p.chains) + '</td>' +
        '<td class="num">' + money(p.tvl_usd) + '</td>' +
        '<td class="num big">' + (p.mcap_usd ? money(p.mcap_usd) : '—') + '</td>' +
        '<td class="num">×' + ratio + '</td>' +
        '<td class="num">' + pct(p.change_7d) + '</td></tr>';
    }).join('');
    return '' +
      '<div class="method"><h2>Already trading — not a launch to farm</h2>' +
      '<p>These protocols already have a token that trades, so they are not on the ranked board. They are here for one reason: ' +
      'their market-cap / TVL ratios are the peer multiples the board prices pre-token launches with. The market\'s own value, ' +
      'never a model\'s.</p></div>' +
      '<table style="margin-top:14px"><thead><tr><th>Protocol</th><th>Category</th><th>Chains</th>' +
      '<th class="num">TVL</th><th class="num">Market cap</th><th class="num">Mcap / TVL</th><th class="num">7d</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table>';
  }

  function methodHtml() {
    var peerRows = D.peers.map(function (p) {
      return '<tr><td>' + esc(p.category) + '</td><td class="num">' + p.peers + '</td>' +
        '<td class="num">×' + p.median_multiple.toFixed(3) + '</td><td class="num">×' + p.used_multiple.toFixed(3) + '</td></tr>';
    }).join('');
    return '' +
      '<div class="method"><h2>How the radar prices a launch</h2>' +
      '<p>Every row on the board is a protocol that <b>records no token</b> in the sealed DefiLlama snapshot and is not a ' +
      'wrapped, staked or bridged product of a token that already trades. The board covers all ' + D.watchlist_size +
      ' watchlist protocols plus ' + D.early_size + ' more below the watchlist floor — every rankable pre-token protocol in the snapshot.</p>' +
      '<div class="formula"><b>implied value = TVL × peer multiple × growth × maturity × chains</b>' +
      '<span class="note">Peer multiple: the category\'s median market-cap / TVL among live-token protocols, shrunk toward the global ' +
      'median 0.2227 when the category has few peers, clamped to 0.05…1.50; a category prices from its own peers only when at least 3 live ' +
      'protocols trade there, else the global median is used. Growth: 7-day TVL change clamped to −50%…+100%, weighted 0.6. ' +
      'Maturity: 0.75 + up to 0.45 over 3 years tracked with no token (0.90 when the listing date is unknown). Chains: +2% per extra chain, to 1.20. ' +
      'No protocol name is ever special-cased — the same function scores every row.</span></div>' +
      '<h3>Peer multiples by category</h3>' +
      '<table><thead><tr><th>Category</th><th class="num">Live peers</th><th class="num">Median ×</th><th class="num">Used ×</th></tr></thead>' +
      '<tbody>' + peerRows + '</tbody></table>' +
      '<p class="note">Categories with fewer than 3 live peers use the global median 0.2227. The implied value is this entry\'s own claim: ' +
      'it says what a token would be worth if the protocol\'s record stayed as it is. It does not predict whether or when a token is issued.</p>' +
      '</div>';
  }

  /* ---------- page shell ---------- */
  function render() {
    var watchTvl = 0, top = D.rows[0];
    D.rows.forEach(function (r) { if (r.watchlist) watchTvl += r.tvl_usd; });
    var html = '' +
      '<header class="top"><div class="eyebrow">Token Radar · ' + D.model_version + '</div>' +
      '<h1>Pre-token protocols, ranked by what their launch would be worth<span class="dot">.</span></h1>' +
      '<p class="lede">A sealed snapshot of every protocol DefiLlama tracks, as of <b>' + esc(D.as_of) + '</b>. ' +
      'The board finds the ones that record no token yet, prices each launch from its own TVL, growth, age and category peers, ' +
      'and gives every one a farm plan with costs and times.</p>' +
      '<div class="stats">' +
      '<div class="stat"><div class="n">' + D.board_size + '</div><div class="l">Pre-token protocols ranked</div></div>' +
      '<div class="stat"><div class="n">' + D.watchlist_size + '</div><div class="l">On the watchlist (floor $50M)</div></div>' +
      '<div class="stat"><div class="n">' + money(watchTvl) + '</div><div class="l">Watchlist TVL</div></div>' +
      '<div class="stat"><div class="n">' + money(top.implied_value_usd) + '</div><div class="l">Top implied value — ' + esc(top.name) + '</div></div>' +
      '<div class="stat"><div class="n">' + D.live_size + '</div><div class="l">Live-token peers priced</div></div>' +
      '</div></header>' +
      '<nav class="tabs" role="tablist">' +
      '<button role="tab" data-tab="board" aria-selected="' + (state.tab === 'board') + '">Pre-token board</button>' +
      '<button role="tab" data-tab="live" aria-selected="' + (state.tab === 'live') + '">Already trading</button>' +
      '<button role="tab" data-tab="method" aria-selected="' + (state.tab === 'method') + '">How it is priced</button>' +
      '</nav>' +
      '<main>' +
      (state.tab === 'board' ? boardHtml() : state.tab === 'live' ? liveHtml() : methodHtml()) +
      '</main>' +
      '<footer><p>Source: ' + esc(D.source) + '. Snapshot as of ' + esc(D.as_of) + '; it does not move.</p>' +
      '<p>Implied values are this entry\'s own claim, never make.fun\'s. “Records no token” is DefiLlama\'s record, not proof a protocol has none. ' +
      'Farm steps are a starting point: check the protocol\'s own pages before you deposit anything.</p></footer>';
    root.innerHTML = html;
    bind();
    if (state.detail) {
      var card = document.getElementById('detail-card');
      if (card) card.scrollIntoView();
    }
  }

  /* ---------- events ---------- */
  function bind() {
    var tabs = root.querySelectorAll('[data-tab]');
    for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener('click', function () {
      state.tab = this.getAttribute('data-tab'); state.detail = null; writeHash(); render();
    });
    var sorts = root.querySelectorAll('[data-sort]');
    for (var j = 0; j < sorts.length; j++) sorts[j].addEventListener('click', function () {
      var k = this.getAttribute('data-sort');
      if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'name' || k === 'category' ? 1 : -1; }
      render();
    });
    var rows = root.querySelectorAll('tbody tr[data-slug]');
    for (var m = 0; m < rows.length; m++) rows[m].addEventListener('click', function () {
      state.detail = this.getAttribute('data-slug'); writeHash(); render();
    });
    var close = root.querySelector('[data-close-detail]');
    if (close) close.addEventListener('click', function () { state.detail = null; writeHash(); render(); });
    var q = document.getElementById('f-q');
    if (q) q.addEventListener('input', function () { state.q = this.value; writeHash(); render(); var nq = document.getElementById('f-q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } });
    var cat = document.getElementById('f-cat');
    if (cat) cat.addEventListener('change', function () { state.cat = this.value; writeHash(); render(); });
    var chain = document.getElementById('f-chain');
    if (chain) chain.addEventListener('change', function () { state.chain = this.value; writeHash(); render(); });
    var tier = document.getElementById('f-tier');
    if (tier) tier.addEventListener('change', function () { state.tier = this.value; writeHash(); render(); });
    var watch = document.getElementById('f-watch');
    if (watch) watch.addEventListener('change', function () { state.watch = this.checked; writeHash(); render(); });
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () { readHash(); render(); });
})();
