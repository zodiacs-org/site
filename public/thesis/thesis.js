// The thesis page's hero, reading and share behaviour, loaded with defer.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var video = document.querySelector('.hero video.hero__media');
  if (video) {
    var heroIsVisible = true;
    var heroPosterPainted = false;
    var syncHeroPlayback = function () {
      if (reduce.matches || !heroIsVisible || !heroPosterPainted) {
        try { video.pause(); } catch (e) {}
      } else {
        video.play().catch(function () {});
      }
    };
    // Let the already-preloaded poster paint before starting the media request.
    // Reduced motion keeps the poster and never needs to download the loop.
    var posterScheduled = false;
    var allowHeroPlayback = function () {
      if (posterScheduled) return;
      posterScheduled = true;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          heroPosterPainted = true;
          syncHeroPlayback();
        });
      });
    };
    var heroPaintObserver;
    var waitForHeroPaint = function () {
      try {
        if (performance.getEntriesByName('first-contentful-paint').length > 0) {
          allowHeroPlayback();
          return;
        }
        if (window.PerformanceObserver
          && PerformanceObserver.supportedEntryTypes.indexOf('paint') !== -1) {
          if (heroPaintObserver) return;
          heroPaintObserver = new PerformanceObserver(function (list) {
            if (list.getEntries().some(function (entry) {
              return entry.name === 'first-contentful-paint';
            })) {
              heroPaintObserver.disconnect();
              allowHeroPlayback();
            }
          });
          heroPaintObserver.observe({ type: 'paint', buffered: true });
          return;
        }
      } catch (e) {}
      // Older browsers without paint entries still get the poster-load/frame gate.
      allowHeroPlayback();
    };
    var heroPoster = new Image();
    heroPoster.onload = waitForHeroPaint;
    heroPoster.onerror = waitForHeroPaint;
    heroPoster.src = video.poster;
    if (heroPoster.complete) waitForHeroPaint();
    if ('IntersectionObserver' in window) {
      // Keep the ambient loop active only while the hero is on screen.
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          heroIsVisible = entry.isIntersecting;
          syncHeroPlayback();
        });
      }, { threshold: 0.05 }).observe(video);
    }
    if (reduce.addEventListener) reduce.addEventListener('change', syncHeroPlayback);
    else if (reduce.addListener) reduce.addListener(syncHeroPlayback);
    syncHeroPlayback();
  }

  var revealTargets = document.querySelectorAll('.reveal, [data-almanac-reveal], [data-visual-reveal]');
  document.documentElement.classList.add('motion-ready');
  if ('IntersectionObserver' in window && !reduce.matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach(function (el) { io.observe(el); });
    // Opening Evidence & disclosures is the reader's own request: show its
    // sections at once instead of waiting for each to scroll into view.
    document.querySelectorAll('details.evidence-vault').forEach(function (vault) {
      vault.addEventListener('toggle', function () {
        if (!vault.open) return;
        vault.querySelectorAll('.reveal, [data-almanac-reveal], [data-visual-reveal]').forEach(function (el) {
          el.classList.add('is-in');
          io.unobserve(el);
        });
      });
    });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-in'); });
  }

})();

/* ── The Pulse — snapshot from /assets/pulse.json, refreshed live
   against the open Wikimedia pageviews API in the visitor's browser. */
(function () {
  var host = document.querySelector('[data-pulse]');
  if (!host || !window.fetch) return;
  var pulseStarted = false;
  var snapshotDate = null;
  var liveTotal = false;
  // The live refresh replaces only the twelve's total and its sparkline;
  // the comparisons and the per-sign bars stay as captured in pulse.json.
  function paintSource() {
    var el = host.querySelector('[data-pulse-src]');
    if (liveTotal) el.textContent = 'Source: Wikimedia · total live' + (snapshotDate ? ' · comparisons captured ' + snapshotDate : '');
    else if (snapshotDate) el.textContent = 'Source: Wikimedia · captured ' + snapshotDate;
  }

  function startPulse() {
    if (pulseStarted) return;
    pulseStarted = true;

  var SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

  function compact(n) {
    if (n == null || !isFinite(n)) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.round(n));
  }

  function sparkline(series) {
    if (!series || series.length < 2) return '';
    var w = 320, h = 56, pad = 4;
    var min = Math.min.apply(null, series), max = Math.max.apply(null, series);
    var span = Math.max(max - min, 1);
    var pts = series.map(function (v, i) {
      var x = pad + (i / (series.length - 1)) * (w - pad * 2);
      var y = h - pad - ((v - min) / span) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg class="pulse__spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="30-day attention sparkline">' +
      '<polyline points="' + pts + '" fill="none" stroke="var(--gold)" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>';
  }

  function setAvg(avg) {
    host.querySelector('[data-pulse-avg]').innerHTML =
      compact(avg) + '<span class="pulse__unit"> / day</span>';
  }

  function renderComparisons(comps) {
    var grid = host.querySelector('[data-pulse-wiki]');
    grid.querySelectorAll('.pulse__cell:not(.pulse__cell--wide)').forEach(function (el) { el.remove(); });
    (comps || []).forEach(function (c) {
      var cell = document.createElement('div');
      cell.className = 'pulse__cell';
      cell.innerHTML =
        '<div class="pulse__k">vs ' + c.label + '</div>' +
        '<div class="pulse__v pulse__v--x">' + c.multiple + '×</div>' +
        '<div class="pulse__sub">' + compact(c.avgDay) + ' / day · single article</div>';
      grid.appendChild(cell);
    });
  }

  // Per-sign encyclopedia reads — one disambiguated article per sign,
  // each bar beside the most read of the token articles in the
  // snapshot's comparison set (the line). The set is named in the
  // copy and is not presented as every token article: it leaves out
  // Bitcoin, whose article is read more than any sign's. All values
  // are from the snapshot; the claim line is computed, never
  // asserted: if the data stops supporting it, the copy changes.
  function renderPerSign(wiki) {
    var per = wiki && wiki.perSignAvgDay;
    var comps = (wiki && wiki.comparisons) || [];
    if (!per || !comps.length) return;
    var rows = SIGNS.map(function (s) {
      return { name: s, v: per[s.toLowerCase()] };
    }).filter(function (r) { return isFinite(r.v); });
    if (!rows.length) return;
    var strongest = comps.reduce(function (a, b) { return b.avgDay > a.avgDay ? b : a; });
    var values = rows.map(function (r) { return r.v; });
    var maxSign = Math.max.apply(null, values);
    var weakest = Math.min.apply(null, values);
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var median = (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
    var countWord = ['no', 'one', 'two', 'three', 'four', 'five', 'six'][comps.length] || String(comps.length);
    var setName = 'the ' + countWord + ' token articles compared here';
    var topName = 'the ' + strongest.label + ' article, the most read of ' + setName;
    var ratio = weakest / Math.max(strongest.avgDay, 1);
    var tick = Math.min((strongest.avgDay / maxSign) * 100, 100);
    host.querySelector('[data-pulse-signs-block]').hidden = false;
    host.querySelector('[data-pulse-signs-claim]').textContent = ratio > 1
      ? 'Every sign article, alone, out-reads each of ' + setName + '. The quietest sign runs ' + ratio.toFixed(1) + '× ' + topName + '.'
      : 'One on one: the median sign article reads at ' + (median / Math.max(strongest.avgDay, 1)).toFixed(1) + '× ' + topName + '.';
    host.querySelector('[data-pulse-signs]').innerHTML = rows.map(function (r) {
      var width = Math.max((r.v / maxSign) * 100, 2);
      return '<div class="pulse__bar">' +
        '<span class="pulse__bar-k">' + r.name + '</span>' +
        '<span class="pulse__bar-track"><span class="pulse__bar-fill is-twelve" style="width:' + width + '%"></span>' +
        '<span class="pulse__bar-tick" style="left:' + tick + '%" aria-hidden="true"></span></span>' +
        '<span class="pulse__bar-v">' + compact(r.v) + '</span></div>';
    }).join('');
    host.querySelector('[data-pulse-signs-note]').textContent =
      'Reads per day, one disambiguated article per sign. The line marks the ' + strongest.label +
      ' article in the same window (' + compact(strongest.avgDay) + ' / day). Token articles compared: ' +
      comps.map(function (c) { return c.label + ' ' + compact(c.avgDay); }).join(' · ') +
      '. Bitcoin is not among them: its article had 3,238 reads a day from 10 Oct to 8 Nov 2026, more than any single sign article in those 30 days.';
  }

  // Per-sign search interest — explicit "{sign} horoscope" queries,
  // anchored to a token term so the twelve are comparable across
  // batches. Hidden until the snapshot carries the data.
  function renderSignTerms(ts) {
    if (!ts || !ts.values) return;
    var rows = SIGNS.map(function (s) {
      var slug = s.toLowerCase();
      return { slug: slug, v: ts.values[slug] };
    }).filter(function (r) { return isFinite(r.v); });
    if (!rows.length) return;
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    var tick = Math.min((1 / max) * 100, 100);
    host.querySelector('[data-pulse-signterms-block]').hidden = false;
    host.querySelector('[data-pulse-signterms-src]').textContent =
      'Google Trends · captured ' + ts.capturedAt + ' · “' + ts.anchor + '” = 1';
    host.querySelector('[data-pulse-signterms]').innerHTML = rows.map(function (r) {
      var width = Math.max((r.v / max) * 100, 2);
      return '<div class="pulse__bar">' +
        '<span class="pulse__bar-k">“' + r.slug + ' horoscope”</span>' +
        '<span class="pulse__bar-track"><span class="pulse__bar-fill is-twelve" style="width:' + width + '%"></span>' +
        '<span class="pulse__bar-tick" style="left:' + tick + '%" aria-hidden="true"></span></span>' +
        '<span class="pulse__bar-v">' + r.v.toFixed(1) + '×</span></div>';
    }).join('');
  }

  fetch('/assets/pulse.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (pulse) {
      var wiki = pulse.wikipedia;
      if (wiki) {
        snapshotDate = pulse.capturedAt;
        paintSource();
        if (!liveTotal) {
          setAvg(wiki.twelveAvgDay);
          host.querySelector('[data-pulse-spark]').innerHTML =
            sparkline((wiki.series || []).map(function (d) { return d.views; }));
        }
        renderComparisons(wiki.comparisons);
        renderPerSign(wiki);
      }

      renderSignTerms(pulse.trendsSigns);

      var trends = pulse.trends;
      if (trends) {
        var block = host.querySelector('[data-pulse-trends]');
        block.hidden = false;
        host.querySelector('[data-pulse-trends-src]').textContent =
          'Source: Google Trends · captured ' + trends.capturedAt + ' · 12mo relative';
        var max = Math.max.apply(null, trends.averages.concat([1]));
        host.querySelector('[data-pulse-bars]').innerHTML = trends.terms.map(function (t, i) {
          var width = Math.max((trends.averages[i] / max) * 100, 2);
          return '<div class="pulse__bar">' +
            '<span class="pulse__bar-k">“' + t + '”</span>' +
            '<span class="pulse__bar-track"><span class="pulse__bar-fill' + (i === 0 ? ' is-twelve' : '') + '" style="width:' + width + '%"></span></span>' +
            '<span class="pulse__bar-v">' + trends.averages[i] + '</span></div>';
        }).join('');
        host.querySelector('[data-pulse-trends-link]').href =
          'https://trends.google.com/trends/explore?date=today%2012-m&q=' + encodeURIComponent(trends.terms.join(','));
      }

      if (pulse.estimates) {
        var eb = host.querySelector('[data-pulse-est-block]');
        eb.hidden = false;
        host.querySelector('[data-pulse-est-src]').textContent = 'Estimates · ' + pulse.estimates.capturedAt;
        host.querySelector('[data-pulse-est]').innerHTML = pulse.estimates.items.map(function (it) {
          return '<div class="pulse__cell">' +
            '<div class="pulse__k">' + it.k + ' <span class="pulse__est">est.</span></div>' +
            '<div class="pulse__v">' + it.v + '</div>' +
            '<div class="pulse__sub">' + it.unit + '</div></div>';
        }).join('');
      }
    })
    .catch(function () {
      if (!liveTotal) host.querySelector('[data-pulse-src]').textContent = 'Attention data unavailable';
    });

  // Live refresh — visitors fetch Wikimedia directly (open, CORS-enabled).
  var end = new Date(Date.now() - 24 * 3600 * 1000);
  var start = new Date(end.getTime() - 29 * 24 * 3600 * 1000);
  var ymd = function (d) { return d.toISOString().slice(0, 10).replace(/-/g, ''); };
  Promise.all(SIGNS.map(function (s) {
    return fetch('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/' +
      encodeURIComponent(s + '_(astrology)') + '/daily/' + ymd(start) + '/' + ymd(end))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  })).then(function (results) {
    var byDate = {};
    results.forEach(function (j) {
      (j.items || []).forEach(function (item) {
        var d = item.timestamp.slice(0, 8);
        byDate[d] = (byDate[d] || 0) + item.views;
      });
    });
    var series = Object.keys(byDate).sort().map(function (k) { return byDate[k]; });
    if (!series.length) return;
    var avg = Math.round(series.reduce(function (s, v) { return s + v; }, 0) / series.length);
    setAvg(avg);
    host.querySelector('[data-pulse-spark]').innerHTML = sparkline(series);
    liveTotal = true;
    paintSource();
    host.classList.add('is-live');
  }).catch(function () { /* snapshot remains */ });
  }

  if ('IntersectionObserver' in window) {
    var pulseObserver = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      pulseObserver.disconnect();
      startPulse();
    }, { rootMargin: '900px 0px' });
    pulseObserver.observe(host);
  } else {
    startPulse();
  }
})();

/* ── Season clock — the hero names the current tropical season.
   Boundaries are Sun-ingress instants from the engine as it stood when
   this table was embedded, through January 2028; they sit within seven
   seconds of src/data/sun-ingresses.json. Days are counted in 24-hour
   steps from the ingress, and the total is the number of steps the
   season touches, so the day shown never passes the total.
   Outside the embedded range the element simply stays hidden. */
(function () {
  var el = document.querySelector('[data-season-clock]');
  if (!el) return;
  var WINDOWS = [
    ['aquarius', '2026-01-20T01:44:34.379Z'],
    ['pisces', '2026-02-18T15:51:26.627Z'],
    ['aries', '2026-03-20T14:45:34.021Z'],
    ['taurus', '2026-04-20T01:39:12.143Z'],
    ['gemini', '2026-05-21T00:37:22.918Z'],
    ['cancer', '2026-06-21T08:25:08.400Z'],
    ['leo', '2026-07-22T19:13:26.161Z'],
    ['virgo', '2026-08-23T02:19:04.019Z'],
    ['libra', '2026-09-23T00:05:40.402Z'],
    ['scorpio', '2026-10-23T09:38:21.771Z'],
    ['sagittarius', '2026-11-22T07:23:27.992Z'],
    ['capricorn', '2026-12-21T20:50:14.049Z'],
    ['aquarius', '2027-01-20T07:29:54.622Z'],
    ['pisces', '2027-02-18T21:33:36.367Z'],
    ['aries', '2027-03-20T20:24:41.375Z'],
    ['taurus', '2027-04-20T07:17:24.887Z'],
    ['gemini', '2027-05-21T06:18:00.373Z'],
    ['cancer', '2027-06-21T14:10:41.847Z'],
    ['leo', '2027-07-23T01:04:31.814Z'],
    ['virgo', '2027-08-23T08:13:59.497Z'],
    ['libra', '2027-09-23T06:01:20.130Z'],
    ['scorpio', '2027-10-23T15:32:42.212Z'],
    ['sagittarius', '2027-11-22T13:16:14.602Z'],
    ['capricorn', '2027-12-22T02:42:10.520Z']
  ];
  var END = Date.parse('2028-01-20T13:21:47.878Z');
  var now = Date.now();
  if (!(now >= Date.parse(WINDOWS[0][1]) && now < END)) return;
  for (var i = 0; i < WINDOWS.length; i++) {
    var from = Date.parse(WINDOWS[i][1]);
    var to = i + 1 < WINDOWS.length ? Date.parse(WINDOWS[i + 1][1]) : END;
    if (now >= from && now < to) {
      var sign = WINDOWS[i][0].charAt(0).toUpperCase() + WINDOWS[i][0].slice(1);
      var day = Math.floor((now - from) / 86400000) + 1;
      var total = Math.ceil((to - from) / 86400000);
      el.textContent = sign + ' season · day ' + day + ' of ' + total;
      el.setAttribute('data-ready', '');
      return;
    }
  }
})();

/* ── Disclosure surfaces — Sections V, VII, X ──
   The page ships every field in its honest default state: an amber
   "Pending disclosure" chip. These JSON files are the single source
   the maintainer edits; whatever they contain is rendered verbatim —
   a filled field shows its value, its as-of date, and a Verify link
   when one is given. Nothing here invents a number.
   PHASE 2: hydrate from @zodiacs/sdk — write these JSON files from
   the SDK at build time; this render contract is unchanged. */
(function () {
  if (!window.fetch) return;
  function fieldAt(data, path) {
    var f = data;
    var parts = path.split('.');
    for (var i = 0; i < parts.length && f; i++) f = f[parts[i]];
    return f && typeof f === 'object' ? f : null;
  }
  function render(el, f) {
    if (!f || f.status === 'pending' || f.value == null) return null; // pending chip stands
    var out = document.createElement('span');
    var val = document.createElement('span');
    val.className = 'disc-val';
    val.textContent = String(f.value);
    out.appendChild(val);
    if (f.asOf) {
      var when = document.createElement('span');
      when.className = 'disc-asof';
      when.textContent = ' as of ' + f.asOf;
      out.appendChild(when);
    }
    if (f.verifyUrl) {
      var verify = document.createElement('a');
      verify.className = 'disc-verify';
      verify.href = String(f.verifyUrl);
      verify.rel = 'noopener noreferrer';
      verify.textContent = ' Verify \u2197';
      out.appendChild(verify);
    }
    el.replaceWith(out);
    return f.asOf || null;
  }
  function hydrate(url, rootId, updatedSel) {
    var root = document.getElementById(rootId);
    if (!root) return;
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var latest = null;
        root.querySelectorAll('[data-field]').forEach(function (el) {
          var asOf = render(el, fieldAt(data, el.getAttribute('data-field')));
          if (asOf && (!latest || asOf > latest)) latest = asOf;
        });
        root.querySelectorAll('[data-asof-field]').forEach(function (el) {
          var f = fieldAt(data, el.getAttribute('data-asof-field'));
          if (f && f.asOf) el.textContent = f.asOf;
        });
        var up = updatedSel && root.querySelector(updatedSel);
        if (up) up.textContent = 'Last updated: ' + (latest || 'no disclosures published yet');
      })
      .catch(function () { /* the static pending state stands */ });
  }
  function hydrateWhenNeeded(url, rootId, updatedSel) {
    var root = document.getElementById(rootId);
    if (!root) return;
    var started = false;
    var observer = null;
    function start() {
      if (started) return;
      started = true;
      if (observer) observer.disconnect();
      hydrate(url, rootId, updatedSel);
    }
    var drawer = root.closest('details');
    if (drawer) {
      drawer.addEventListener('toggle', function () { if (drawer.open) start(); });
      if (!drawer.open) return;
    }
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) start();
      }, { rootMargin: '900px 0px' });
      observer.observe(root);
    } else {
      start();
    }
  }
  hydrateWhenNeeded('/thesis/thesis-disclosure.json', 'the-instrument', '[data-disclosure-updated]');
  hydrateWhenNeeded('/thesis/thesis-candidacy.json', 'the-candidacy', null);
  hydrateWhenNeeded('/thesis/thesis-test.json', 'the-test', null);
})();

/* Open a collapsed evidence ancestor for deep links, then provide a
   canonical-link copy action that never changes the reader's URL. */
(function () {
  function exposeHashTarget() {
    var id = location.hash.slice(1);
    if (!id) return;
    var target;
    try { target = document.getElementById(decodeURIComponent(id)); } catch (error) { return; }
    if (!target) return;
    var ancestors = [];
    for (var node = target.parentElement; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') ancestors.unshift(node);
    }
    var opened = ancestors.some(function (details) { return !details.open; });
    ancestors.forEach(function (details) { details.open = true; });
    if (opened) target.scrollIntoView({ block: 'start' });
  }
  exposeHashTarget();
  window.addEventListener('hashchange', exposeHashTarget);

  var button = document.querySelector('[data-thesis-copy-link]');
  var status = document.querySelector('[data-thesis-share-status]');
  var label = document.querySelector('[data-thesis-copy-label]');
  if (!button || !status || !label) return;
  var canonical = document.querySelector('link[rel="canonical"]');
  var url = canonical ? canonical.href : location.origin + location.pathname;
  function fallbackCopy(value) {
    var input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (error) {}
    input.remove();
    return copied ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }
  button.addEventListener('click', function () {
    var copy = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(url)
      : fallbackCopy(url);
    copy.then(function () {
      label.textContent = 'Link copied';
      status.textContent = 'Canonical thesis link copied.';
      window.setTimeout(function () {
        label.textContent = 'Copy this thesis';
        status.textContent = '';
      }, 2400);
    }).catch(function () {
      label.textContent = 'Copy unavailable';
      status.textContent = 'Copy unavailable. The canonical link is ' + url;
    });
  });
})();
