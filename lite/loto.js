/* Loto M1 lite: portare ES5 a lib/telescop_m1.dart si lib/tandem3_ln2.dart (pentru Safari vechi, ex. iOS 10). */
var Loto = (function () {
  var GAMES = [
    { name: 'Loto 6/40', file: 'L40D.csv', balls: [['N1', 1, 40], ['N2', 2, 40], ['N3', 3, 40], ['N4', 4, 40], ['N5', 5, 40], ['N6', 6, 40]] },
    { name: 'Loto 6/49', file: 'L49D.csv', balls: [['N1', 1, 49], ['N2', 2, 49], ['N3', 3, 49], ['N4', 4, 49], ['N5', 5, 49], ['N6', 6, 49]] },
    { name: 'Joker 5/45', file: 'JokerD.csv', balls: [['N1', 1, 45], ['N2', 2, 45], ['N3', 3, 45], ['N4', 4, 45], ['N5', 5, 45], ['J', 6, 20]] }
  ];

  function parseColumn(csv, col) {
    var dates = [], values = [];
    var lines = csv.replace(/\r/g, '').split('\n');
    for (var i = 1; i < lines.length; i++) {
      var f = lines[i].split(',');
      if (f.length > col) {
        var s = f[col].replace(/^\s+|\s+$/g, '');
        if (/^-?\d+$/.test(s)) { dates.push(f[0]); values.push(parseInt(s, 10)); }
      }
    }
    return { dates: dates, values: values };
  }

  function w(k) { return Math.log(k) + 1; }
  function w2(k) { var t = Math.log(k) + 1; return t * t; }

  // Sume partiale S(m) prin coeficientii A(1..N-1), verificate pas cu pas.
  function coefficients(p, wf) {
    var n = p.length, a = new Array(n), prefix = new Array(n), k;
    function s(k) { return k >= 1 ? wf(k) * p[k] : 0; }
    for (k = n - 1; k >= 1; k--) a[k] = (k % 2 === 0 ? 1 : -1) * (s(k) - s(k - 1)) / p[k - 1];
    var acc = 0, errors = 0;
    prefix[0] = 0;
    for (k = 1; k < n; k++) {
      acc += (k % 2 === 0 ? 1 : -1) * a[k] * p[k - 1];
      prefix[k] = acc;
      if (Math.abs(acc / wf(k) - p[k]) > 1e-9 * Math.max(1, Math.abs(acc))) errors++;
    }
    return { prefix: prefix, errors: errors };
  }

  function m1Modify(x, balls) {
    var k = balls.length, mainMax = balls[0][2], xm = new Array(k);
    for (var i = k - 1; i >= 0; i--) {
      var m = balls[i][2], cnt = k - 1 - i;
      if (m !== mainMax || cnt === 0) { xm[i] = x[i]; continue; }
      var lam = cnt / (m - 1), sum = 0;
      for (var j = i + 1; j < k; j++) sum += xm[j];
      var e = (m * (m + 1) / 2 - sum) / (m - cnt);
      xm[i] = (1 - lam) * x[i] + lam * e;
    }
    return xm;
  }

  function nearest(x, max, forbid) {
    var c = [];
    for (var v = 1; v <= max; v++) c.push(v);
    c.sort(function (a, b) { var d = Math.abs(a - x) - Math.abs(b - x); return d !== 0 ? d : a - b; });
    for (var i = 0; i < c.length; i++) if (!forbid[c[i]]) return c[i];
  }

  function assignOptimal(xm, balls) {
    var mainMax = balls[0][2], main = [], i, j, v;
    for (i = 0; i < balls.length; i++) if (balls[i][2] === mainMax) main.push(i);
    var order = main.slice().sort(function (a, b) { return xm[a] !== xm[b] ? (xm[a] < xm[b] ? -1 : 1) : a - b; });
    var kk = order.length, m = mainMax, best = [], arg = [];
    for (j = 0; j <= kk; j++) {
      best.push([]); arg.push([]);
      for (v = 0; v <= m + 1; v++) { best[j].push(Infinity); arg[j].push(0); }
    }
    for (v = 0; v <= m; v++) best[0][v] = 0;
    for (j = 1; j <= kk; j++) {
      var x = xm[order[j - 1]], runMin = Infinity, runArg = 0;
      for (v = 1; v <= m; v++) {
        if (best[j - 1][v - 1] < runMin) { runMin = best[j - 1][v - 1]; runArg = v - 1; }
        best[j][v] = runMin + (v - x) * (v - x);
        arg[j][v] = runArg;
      }
    }
    v = 1;
    for (var u = 2; u <= m; u++) if (best[kk][u] < best[kk][v]) v = u;
    var r = new Array(balls.length);
    for (j = kk; j >= 1; j--) { r[order[j - 1]] = v; v = arg[j][v]; }
    for (i = 0; i < balls.length; i++) {
      if (r[i] === undefined) {
        var forbid = {};
        for (j = 0; j < main.length; j++) if (r[main[j]] <= balls[i][2]) forbid[r[main[j]]] = true;
        r[i] = nearest(xm[i], balls[i][2], forbid);
      }
    }
    return r;
  }

  function m1Step(prefixes, balls, m) {
    var x = [];
    for (var i = 0; i < prefixes.length; i++) x.push(prefixes[i][m] / w(m + 1));
    var xm = m1Modify(x, balls);
    return { x: x, xm: xm, r: assignOptimal(xm, balls) };
  }

  function runM1(game, csv) {
    var cols = [], prefixes = [], errors = 0, i;
    for (i = 0; i < game.balls.length; i++) {
      var c = parseColumn(csv, game.balls[i][1]);
      cols.push(c);
      var co = coefficients(c.values, w);
      prefixes.push(co.prefix); errors += co.errors;
    }
    var n = cols[0].values.length, st = m1Step(prefixes, game.balls, n - 1), last = [];
    for (i = 0; i < cols.length; i++) last.push(cols[i].values[n - 1]);
    return { lastDate: cols[0].dates[n - 1], lastDraw: last, x: st.x, xm: st.xm, forecast: st.r, n: n, errors: errors, prefixes: prefixes };
  }

  // ---- Tandem 3, normare (ln k + 1)^2, variantele R (urna redusa) si G (pas ciclic) ----
  function clamp(v, lo, hi) { return Math.min(Math.max(Math.floor(v + 0.5), lo), hi); }
  function mod(a, m) { return ((a % m) + m) % m; }
  function free(m, excl) { var o = []; for (var v = 1; v <= m; v++) if (excl.indexOf(v) < 0) o.push(v); return o; }
  function below(f, x) { var c = 0; for (var i = 0; i < f.length; i++) if (f[i] < x) c++; return c; }

  function tandemSeries(p1, p2, p3, m) {
    var o = { P1: [], s2: [], s3: [], d2: [], d3: [] };
    for (var i = 0; i < p1.length; i++) {
      var a = p1[i], b = p2[i], c = p3[i];
      o.P1.push(a);
      o.s2.push(b - (b > a ? 1 : 0));
      o.s3.push(c - (a < c ? 1 : 0) - (b < c ? 1 : 0));
      o.d2.push(mod(b - a, m));
      var f = free(m, [a, b]), d3 = mod(f.indexOf(c) + 1 - below(f, b), m - 2);
      o.d3.push(d3 === 0 ? m - 2 : d3);
    }
    return o;
  }

  function tandemStep(s, n, a, m, variant) {
    var x1 = s.P1[n - a] / w2(n), r1 = clamp(x1, 1, m), h2, h3, r2, r3;
    if (variant === 'R') {
      h2 = s.s2[n - a] / w2(n); h3 = s.s3[n - a] / w2(n);
      r2 = free(m, [r1])[clamp(h2, 1, m - 1) - 1];
      r3 = free(m, [r1, r2])[clamp(h3, 1, m - 2) - 1];
    } else {
      h2 = s.d2[n - 1] / w2(n); h3 = s.d3[n - 1] / w2(n);
      r2 = mod(r1 - 1 + clamp(h2, 1, m - 1), m) + 1;
      var f = free(m, [r1, r2]);
      r3 = f[mod(below(f, r2) - 1 + clamp(h3, 1, m - 2), m - 2)];
    }
    return { hats: [x1, h2, h3], r: [r1, r2, r3] };
  }

  function prepareTandem(game, csv) {
    var cols = [];
    for (var i = 0; i < 3; i++) cols.push(parseColumn(csv, game.balls[i][1]));
    var m = game.balls[0][2], ser = tandemSeries(cols[0].values, cols[1].values, cols[2].values, m);
    var pref = {}, errors = 0;
    for (var k in ser) { var c = coefficients(ser[k], w2); pref[k] = c.prefix; errors += c.errors; }
    var n = cols[0].values.length;
    return { m: m, n: n, series: ser, prefixes: pref, errors: errors,
             lastDate: cols[0].dates[n - 1], lastDraw: [cols[0].values[n - 1], cols[1].values[n - 1], cols[2].values[n - 1]],
             forecast: function (a, v) { return tandemStep(pref, n, a, m, v); } };
  }

  return { GAMES: GAMES, parseColumn: parseColumn, coefficients: coefficients, w: w, w2: w2, m1Step: m1Step,
           runM1: runM1, tandemStep: tandemStep, prepareTandem: prepareTandem };
})();
if (typeof module !== 'undefined') module.exports = Loto;
