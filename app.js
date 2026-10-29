/* 数值分析互动学习中心 — 全部交互逻辑 */
(function () {
  "use strict";

  /* ---------------- 公共工具 ---------------- */
  var cssCache = {};
  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function themeColors() {
    return {
      ink: css("--ink"), muted: css("--muted"), grid: css("--gridline"),
      axis: css("--axis"), surface: css("--chart-surface"), accent: css("--accent"),
      s1: css("--s1"), s2: css("--s2"), s3: css("--s3"), s4: css("--s4"),
      s5: css("--s5"), s7: css("--s7"), good: css("--good"), bad: css("--bad")
    };
  }
  function ctx2d(canvas, hCss) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hCss * dpr);
    canvas.style.height = hCss + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: hCss };
  }
  // 坐标映射器
  function mapper(x0, x1, y0, y1, w, h, pad) {
    pad = pad || { l: 46, r: 14, t: 12, b: 30 };
    return {
      x: function (v) { return pad.l + (v - x0) / (x1 - x0) * (w - pad.l - pad.r); },
      y: function (v) { return h - pad.b - (v - y0) / (y1 - y0) * (h - pad.t - pad.b); },
      pad: pad, w: w, h: h
    };
  }
  function drawAxes(ctx, m, c, xticks, yticks, xlabel) {
    ctx.strokeStyle = c.axis; ctx.lineWidth = 1;
    ctx.fillStyle = c.muted; ctx.font = "10px ui-monospace, monospace";
    var i, t;
    ctx.textAlign = "center";
    for (i = 0; i < xticks.length; i++) {
      t = xticks[i];
      ctx.beginPath(); ctx.moveTo(m.x(t.v), m.pad.t); ctx.lineTo(m.x(t.v), m.h - m.pad.b);
      ctx.strokeStyle = c.grid; ctx.stroke();
      ctx.fillText(t.s, m.x(t.v), m.h - m.pad.b + 14);
    }
    ctx.textAlign = "right";
    for (i = 0; i < yticks.length; i++) {
      t = yticks[i];
      ctx.beginPath(); ctx.moveTo(m.pad.l, m.y(t.v)); ctx.lineTo(m.w - m.pad.r, m.y(t.v));
      ctx.strokeStyle = c.grid; ctx.stroke();
      ctx.fillText(t.s, m.pad.l - 6, m.y(t.v) + 3);
    }
  }
  function logTicks(v0, v1, fmt) {
    var out = [], p = Math.ceil(Math.log10(v0));
    for (; p <= Math.floor(Math.log10(v1)); p++) out.push({ v: Math.pow(10, p), s: fmt(Math.pow(10, p)) });
    return out;
  }
  function sup(tag) { return { "10": "¹⁰" }[tag] || tag; }
  function fmtExp(v) {
    if (v === 0) return "0";
    var e = Math.floor(Math.log10(Math.abs(v)));
    var m = v / Math.pow(10, e);
    return m.toFixed(1) + "e" + e;
  }

  var redrawAll = [];
  function onThemeChange(fn) { redrawAll.push(fn); }
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (mq.addEventListener) mq.addEventListener("change", function () { redrawAll.forEach(function (f) { f(); }); });

  function el(id) { return document.getElementById(id); }

  /* ---------------- 进度跟踪 ---------------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var progress = store.get("na-progress", {});
  function refreshProgress() {
    var done = 0;
    for (var i = 1; i <= 11; i++) {
      var on = !!progress["ch" + i];
      var cb = el("done-ch" + i);
      if (cb) cb.checked = on;
      var nav = el("nav-ch" + i);
      if (nav) nav.classList.toggle("done", on);
      if (on) done++;
    }
    var bar = el("pbar-fill"), lab = el("pbar-label");
    if (bar) bar.style.width = (done / 11 * 100) + "%";
    if (lab) lab.textContent = done + " / 11 章";
  }
  for (var pi = 1; pi <= 11; pi++) {
    (function (i) {
      var cb = el("done-ch" + i);
      if (cb) cb.addEventListener("change", function () {
        progress["ch" + i] = cb.checked; store.set("na-progress", progress); refreshProgress();
      });
    })(pi);
  }
  refreshProgress();

  /* ---------------- 目录 scrollspy ---------------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".sidenav a[href^='#']"));
  var secMap = {};
  navLinks.forEach(function (a) { secMap[a.getAttribute("href").slice(1)] = a; });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && secMap[en.target.id]) {
          navLinks.forEach(function (a) { a.classList.remove("active"); });
          secMap[en.target.id].classList.add("active");
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    Object.keys(secMap).forEach(function (id) { var s = el(id); if (s) io.observe(s); });
  }

  /* ---------------- 思维导图 ---------------- */
  var MM = [
    { t: "01 误差与浮点数", id: "ch1", ch: ["误差四来源", "绝对/相对误差", "有效数字与互推定理", "误差传播(微分法)", "浮点数与机器精度", "数值稳定五原则", "秦九韶算法"] },
    { t: "02 范数与性态", id: "ch2", ch: ["向量范数三公理", "范数等价性", "单位球几何", "矩阵范数/算子范数", "谱半径 ρ(A)≤‖A‖", "条件数与扰动界", "残差≠误差"] },
    { t: "03 直接解法", id: "ch3", ch: ["Gauss 消元(n³/3)", "选主元", "LU/Doolittle", "Cholesky/LDLᵀ", "追赶法", "增长因子与迭代改善"] },
    { t: "04 迭代法", id: "ch4", ch: ["矩阵分裂 A=M−N", "收敛充要 ρ(B)<1", "Jacobi", "Gauss-Seidel", "SOR 最优因子", "对角占优判据", "共轭斜量法"] },
    { t: "05 非线性方程", id: "ch5", ch: ["二分法", "不动点迭代", "收敛阶", "Aitken/Steffensen 加速", "Newton 法(平方收敛)", "弦截法(1.618阶)", "方程组 Newton"] },
    { t: "06 最小二乘", id: "ch6", ch: ["问题提法", "法方程 AᵀAc=Aᵀb", "多项式拟合", "Gram-Schmidt/QR", "SVD 与广义逆"] },
    { t: "07 特征值计算", id: "ch7", ch: ["Gershgorin 圆盘", "幂法(收敛比|λ₂/λ₁|)", "反幂法与位移", "Rayleigh 商加速", "Jacobi 旋转", "QR 方法"] },
    { t: "08 插值法", id: "ch8", ch: ["插值唯一性", "Lagrange 插值", "差商表与 Newton 插值", "插值余项", "Hermite 插值", "Runge 现象", "分段低次", "三次样条(三弯矩)"] },
    { t: "09 函数逼近", id: "ch9", ch: ["最佳一致逼近", "Chebyshev 多项式", "交错定理", "最佳平方逼近", "正交多项式族"] },
    { t: "10 数值积分与微分", id: "ch10", ch: ["Newton-Cotes", "代数精度", "复化梯形/Simpson", "Romberg 外推", "Gauss 型求积", "数值微分最优步长"] },
    { t: "11 常微分方程", id: "ch11", ch: ["Euler 法", "改进 Euler", "Runge-Kutta", "收敛性与稳定性", "绝对稳定域", "线性多步法"] }
  ];
  (function buildMindmap() {
    var host = el("mindmap");
    if (!host) return;
    var ul = document.createElement("ul");
    var root = document.createElement("li");
    root.innerHTML = '<span class="mm-node root">数值分析 · 全课程</span>';
    var cul = document.createElement("ul");
    MM.forEach(function (c) {
      var li = document.createElement("li");
      var kids = c.ch.map(function (s) { return "<li><span class='mm-node leaf' data-t='" + c.id + "'>" + s + "</span></li>"; }).join("");
      li.innerHTML = "<span class='mm-node ch' data-t='" + c.id + "'><span class='tw'>▾</span>" + c.t + "</span><ul>" + kids + "</ul>";
      cul.appendChild(li);
    });
    root.appendChild(cul);
    ul.appendChild(root);
    host.appendChild(ul);
    host.addEventListener("click", function (e) {
      var n = e.target.closest(".mm-node");
      if (!n) return;
      var li = n.parentElement;
      var sub = li.querySelector("ul");
      if (sub && n.classList.contains("ch")) {
        var hidden = sub.style.display === "none";
        sub.style.display = hidden ? "" : "none";
        n.querySelector(".tw").textContent = hidden ? "▾" : "▸";
      } else if (n.dataset.t) {
        var tgt = el(n.dataset.t);
        if (tgt) tgt.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    el("mm-expand").addEventListener("click", function () {
      host.querySelectorAll("ul ul").forEach(function (u) { u.style.display = ""; });
      host.querySelectorAll(".tw").forEach(function (t) { t.textContent = "▾"; });
    });
    el("mm-collapse").addEventListener("click", function () {
      host.querySelectorAll("ul ul").forEach(function (u) { u.style.display = "none"; });
      host.querySelectorAll(".tw").forEach(function (t) { t.textContent = "▸"; });
    });
  })();

  /* ---------------- 考试权重条形图 ---------------- */
  (function () {
    var host = el("wbars");
    if (!host) return;
    var rows = [
      ["01 误差与浮点数", 8, "mid"], ["02 范数与条件数", 14, "max"], ["03 直接解法", 12, "high"],
      ["04 迭代法", 12, "high"], ["05 非线性方程", 10, "high"], ["06 最小二乘", 10, "mid"],
      ["07 特征值计算", 9, "low"], ["08 插值法", 14, "max"], ["09 函数逼近", 9, "low"],
      ["10 数值积分微分", 11, "high"], ["11 常微分方程", 10, "high"]
    ];
    var col = { max: "var(--s2)", high: "var(--s1)", mid: "var(--s3)", low: "var(--muted)" };
    host.innerHTML = rows.map(function (r) {
      return "<div class='wbar-row'><span class='nm'>" + r[0] + "</span>" +
        "<span class='bar'><i style='width:" + (r[1] / 14 * 100) + "%;background:" + col[r[2]] + "'></i></span>" +
        "<span class='val'>" + r[1] + " h</span></div>";
    }).join("");
  })();

  /* ---------------- 依赖图高亮 ---------------- */
  var THREADS = {
    a: { nodes: ["c1", "c2", "c3", "c11"], edges: ["e12", "e23"] },
    b: { nodes: ["c2", "c3", "c4", "c6", "c7"], edges: ["e23", "e24", "e26", "e27", "e34", "e36", "e37"] },
    c: { nodes: ["c8", "c9", "c10", "c11"], edges: ["e89", "e810", "e811", "e910", "e1011"] }
  };
  function depHighlight(key) {
    var svg = el("depsvg");
    if (!svg) return;
    svg.querySelectorAll(".node, .edge").forEach(function (n) { n.classList.remove("dim"); });
    svg.querySelectorAll(".hl-a,.hl-b,.hl-c").forEach(function (n) { n.classList.remove("hl-a", "hl-b", "hl-c"); });
    svg.querySelectorAll(".edge-a,.edge-b,.edge-c").forEach(function (n) { n.classList.remove("edge-a", "edge-b", "edge-c"); });
    if (!key) return;
    var th = THREADS[key];
    svg.querySelectorAll(".node, .edge").forEach(function (n) { n.classList.add("dim"); });
    th.nodes.forEach(function (id) {
      var n = el("dep-" + id);
      if (n) { n.classList.remove("dim"); n.classList.add("hl-" + key); }
    });
    th.edges.forEach(function (id) {
      var n = el("dep-" + id);
      if (n) { n.classList.remove("dim"); n.classList.add("edge-" + key); }
    });
  }
  document.querySelectorAll(".dep-tools button").forEach(function (b) {
    b.addEventListener("click", function () {
      var on = b.classList.contains("on");
      document.querySelectorAll(".dep-tools button").forEach(function (x) { x.classList.remove("on"); });
      if (!on) { b.classList.add("on"); depHighlight(b.dataset.th); } else depHighlight(null);
    });
  });
  document.querySelectorAll(".depsvg .node").forEach(function (n) {
    n.addEventListener("click", function () {
      var t = el(n.dataset.t);
      if (t) t.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* =====================================================
     第1章 Demo A: IEEE 754 浮点拆解
  ===================================================== */
  (function () {
    var inp = el("fp-input"), out = el("fp-out");
    if (!inp) return;
    function show() {
      var v = parseFloat(inp.value);
      if (!isFinite(v)) { out.textContent = "请输入一个有限小数"; return; }
      var buf = new ArrayBuffer(8), f64 = new Float64Array(buf), u8 = new Uint8Array(buf);
      f64[0] = v;
      // 大端序重排
      var bits = "";
      for (var i = 7; i >= 0; i--) bits += ("0000000" + u8[i].toString(2)).slice(-8);
      var sign = bits[0], exp = bits.slice(1, 12), man = bits.slice(12);
      var html = "";
      function row(s, cls) { for (var k = 0; k < s.length; k++) html += "<span class='b " + cls + "'>" + s[k] + "</span>"; }
      row(sign, "sign"); row(exp, "exp"); row(man, "man");
      var e = parseInt(exp, 2);
      var exact = v.toPrecision(17);
      out.innerHTML =
        "<div class='bitgrid'>" + html + "</div>" +
        "<div style='margin-top:10px'>符号 <b style='color:var(--s2)'>" + sign + "</b>　指数 <b style='color:var(--s1)'>" + exp + "</b> (e=" + (e - 1023) + ")　尾数 <b style='color:var(--s3)'>" + man.slice(0, 13) + "…</b></div>" +
        "<div style='margin-top:6px'>机器实际存储值 = <b>" + exact + "</b>" + (String(v) !== exact.replace(/0+$/, "").replace(/\.$/, "") ? "（与输入不同 ⇒ 舍入误差）" : "") + "</div>";
    }
    inp.addEventListener("input", show);
    show();
  })();

  /* =====================================================
     第1章 Demo B: 灾难性抵消
     不稳定式 (sqrt(1+h)-1)/h vs 稳定式 1/(sqrt(1+h)+1)
  ===================================================== */
  (function () {
    var cv = el("cv-cancel");
    if (!cv) return;
    var slider = el("cancel-h"), hOut = el("cancel-hv"), rd = el("cancel-read");
    function data() {
      var pts = { u: [], s: [] };
      for (var i = 0; i <= 120; i++) {
        var lg = -1 - i / 120 * 15;
        var h = Math.pow(10, lg);
        var u = (Math.sqrt(1 + h) - 1) / h;
        var s = 1 / (Math.sqrt(1 + h) + 1);
        pts.u.push([lg, Math.abs(u - 0.5) / 0.5]);
        pts.s.push([lg, Math.abs(s - 0.5) / 0.5]);
      }
      return pts;
    }
    var PTS = data();
    function draw() {
      var c = themeColors(), g = ctx2d(cv, 260), ctx = g.ctx;
      var m = mapper(-16, -1, -17, 0.5, g.w, g.h);
      drawAxes(ctx, m, c,
        [-16, -12, -8, -4, -1].map(function (v) { return { v: v, s: "1e" + v }; }),
        [-16, -12, -8, -4, 0].map(function (p) { return { v: p, s: "1e" + p }; }));
      // 横轴实际存的是 lg，这里 log-log：y 已是 log10(err)
      function plot(arr, col) {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
        var started = false;
        arr.forEach(function (p) {
          var ly = Math.log10(Math.max(p[1], 1e-17));
          var X = m.x(p[0]), Y = m.y(ly);
          if (!started) { ctx.moveTo(X, Y); started = true; } else ctx.lineTo(X, Y);
        });
        ctx.stroke();
      }
      plot(PTS.u, c.s2); plot(PTS.s, c.s3);
      // 当前 h 标记
      var lg = parseFloat(slider.value), h = Math.pow(10, lg);
      hOut.textContent = "1e" + lg.toFixed(1);
      var u = (Math.sqrt(1 + h) - 1) / h, s = 1 / (Math.sqrt(1 + h) + 1);
      var eu = Math.abs(u - 0.5) / 0.5, es = Math.abs(s - 0.5) / 0.5;
      ctx.fillStyle = c.s2; ctx.beginPath(); ctx.arc(m.x(lg), m.y(Math.log10(Math.max(eu, 1e-17))), 5, 0, 7); ctx.fill();
      ctx.fillStyle = c.s3; ctx.beginPath(); ctx.arc(m.x(lg), m.y(Math.log10(Math.max(es, 1e-17))), 5, 0, 7); ctx.fill();
      ctx.fillStyle = c.muted; ctx.font = "11px sans-serif"; ctx.textAlign = "left";
      ctx.fillText("横轴: 步长 h (对数)", m.pad.l, g.h - 4);
      ctx.save(); ctx.translate(12, g.h / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center";
      ctx.fillText("相对误差 (对数)", 0, 0); ctx.restore();
      rd.textContent =
        "h = " + h.toExponential(2) + "    真值 = 0.5\n" +
        "不稳定式 (√(1+h)−1)/h = " + u.toPrecision(12) + "  相对误差 " + eu.toExponential(2) + "\n" +
        "稳定式   1/(√(1+h)+1) = " + s.toPrecision(12) + "  相对误差 " + es.toExponential(2) + "\n" +
        (h < 1e-8 ? "→ h 足够小时 √(1+h)≈1，两近数相减，有效数字全部丢失！" : "→ 向左拖动滑块，观察橙色曲线（不稳定式）误差随 h 减小反而爆炸");
    }
    slider.addEventListener("input", draw);
    onThemeChange(draw);
    draw();
  })();

  /* =====================================================
     第2章 Demo A: p-范数单位球
  ===================================================== */
  (function () {
    var cv = el("cv-ball");
    if (!cv) return;
    var slider = el("ball-p"), out = el("ball-pv"), rd = el("ball-read");
    function draw() {
      var p = parseFloat(slider.value);
      out.textContent = p >= 7.9 ? "∞" : p.toFixed(1);
      var c = themeColors(), g = ctx2d(cv, 300), ctx = g.ctx;
      var L = 1.5, m = mapper(-L, L, -L, L, g.w, g.h, { l: 20, r: 20, t: 14, b: 14 });
      // 参考：p=1 菱形 / p=2 圆 / p=∞ 正方形（淡）
      function ball(pp, col, lw, dash) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
        ctx.beginPath();
        for (var i = 0; i <= 360; i++) {
          var th = i / 180 * Math.PI;
          var co = Math.cos(th), si = Math.sin(th);
          var r;
          if (pp === Infinity) r = 1 / Math.max(Math.abs(co), Math.abs(si));
          else r = Math.pow(Math.pow(Math.abs(co), pp) + Math.pow(Math.abs(si), pp), -1 / pp);
          var X = m.x(r * co), Y = m.y(r * si);
          if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
        ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      }
      ball(1, c.axis, 1, [4, 4]); ball(2, c.axis, 1, [4, 4]); ball(Infinity, c.axis, 1, [4, 4]);
      ball(p >= 7.9 ? Infinity : p, c.accent, 2.5);
      // 坐标轴
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(m.x(-L), m.y(0)); ctx.lineTo(m.x(L), m.y(0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.x(0), m.y(-L)); ctx.lineTo(m.x(0), m.y(L)); ctx.stroke();
      var v1 = 3, v2 = 4, nv = p >= 7.9 ? Math.max(v1, v2) : Math.pow(Math.pow(v1, p) + Math.pow(v2, p), 1 / p);
      rd.textContent = "p = " + (p >= 7.9 ? "∞" : p.toFixed(1)) + "    ‖(3,4)‖p = " + nv.toFixed(4) +
        "\n虚线为 p=1（菱形）、p=2（圆）、p=∞（正方形）。p→∞ 时单位球“涨”满正方形，p→1 时收缩成菱形。";
    }
    slider.addEventListener("input", draw);
    onThemeChange(draw);
    draw();
  })();

  /* =====================================================
     第2章 Demo B: 条件数放大
     A=diag(κ,1), b=A·(1,1), 最坏方向扰动
  ===================================================== */
  (function () {
    var cv = el("cv-cond");
    if (!cv) return;
    var ks = el("cond-k"), ds = el("cond-d"), rd = el("cond-read");
    var ko = el("cond-kv"), doo = el("cond-dv");
    function draw() {
      var kappa = Math.pow(10, parseFloat(ks.value));
      var delta = parseFloat(ds.value) / 100;
      ko.textContent = fmtExp(kappa); doo.textContent = (delta * 100).toFixed(1) + "%";
      var normB = Math.sqrt(kappa * kappa + 1), normX = Math.SQRT2;
      var relIn = delta;
      var relOut = delta * normB / normX; // 最坏方向
      var amp = relOut / relIn;
      rd.textContent =
        "κ(A) = " + fmtExp(kappa) + "    输入相对扰动 ‖δb‖/‖b‖ = " + (relIn * 100).toFixed(2) + "%\n" +
        "输出相对误差 ‖δx‖/‖x‖ = " + (relOut * 100).toFixed(2) + "%    放大倍数 ≈ " + amp.toFixed(1) + "（≈ κ/√2，最坏方向贴近 κ）\n" +
        (kappa > 1e4 ? "→ 病态！有效数字约损失 lg κ ≈ " + (Math.log10(kappa)).toFixed(1) + " 位" : "→ 拖动 κ 滑块看放大倍数如何随条件数线性增长");
      // 柱状对比
      var c = themeColors(), g = ctx2d(cv, 180), ctx = g.ctx;
      ctx.clearRect(0, 0, g.w, g.h);
      var maxV = Math.max(relIn, relOut) * 1.15;
      var base = g.h - 26, bw = Math.min(120, g.w / 5);
      function bar(x, v, col, lab) {
        var h = maxV > 0 ? v / maxV * (base - 20) : 0;
        ctx.fillStyle = col;
        ctx.fillRect(x, base - h, bw, h);
        ctx.fillStyle = c.muted; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(lab, x + bw / 2, base + 16);
        ctx.fillStyle = c.ink;
        ctx.fillText((v * 100).toFixed(2) + "%", x + bw / 2, base - h - 6);
      }
      var cx = g.w / 2;
      bar(cx - bw - 40, relIn, c.s1, "输入扰动 ‖δb‖/‖b‖");
      bar(cx + 40, relOut, c.s2, "输出误差 ‖δx‖/‖x‖");
      ctx.strokeStyle = c.axis; ctx.beginPath(); ctx.moveTo(20, base); ctx.lineTo(g.w - 20, base); ctx.stroke();
    }
    ks.addEventListener("input", draw); ds.addEventListener("input", draw);
    onThemeChange(draw);
    draw();
  })();

  /* =====================================================
     第3章: Gauss 消元步进
  ===================================================== */
  (function () {
    var host = el("gauss-stage");
    if (!host) return;
    var A0 = [[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], b0 = [8, -11, -3];
    // 预计算各阶段快照
    var stages = [];
    var A = A0.map(function (r) { return r.slice(); }), b = b0.slice();
    stages.push({ A: A.map(function (r) { return r.slice(); }), b: b.slice(), note: "原始增广矩阵 [A|b]，目标：消成上三角", hot: [], piv: null, sol: [] });
    var L = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    // 第1列
    var m21 = A[1][0] / A[0][0], m31 = A[2][0] / A[0][0];
    for (var j = 0; j < 3; j++) { A[1][j] -= m21 * A[0][j]; A[2][j] -= m31 * A[0][j]; }
    b[1] -= m21 * b[0]; b[2] -= m31 * b[0];
    L[1][0] = m21; L[2][0] = m31;
    stages.push({ A: A.map(function (r) { return r.slice(); }), b: b.slice(), note: "消第1列：r₂ ← r₂ − (−1.5)r₁，r₃ ← r₃ − (−1)r₁（乘数记入 L）", hot: [1, 2], piv: [0, 0], sol: [] });
    var m32 = A[2][1] / A[1][1];
    for (var j2 = 1; j2 < 3; j2++) A[2][j2] -= m32 * A[1][j2];
    b[2] -= m32 * b[1];
    L[2][1] = m32;
    stages.push({ A: A.map(function (r) { return r.slice(); }), b: b.slice(), note: "消第2列：r₃ ← r₃ − 4·r₂。U 已就位，开始回代", hot: [2], piv: [1, 1], sol: [] });
    var x = [0, 0, 0];
    x[2] = b[2] / A[2][2];
    stages.push({ A: A.map(function (r) { return r.slice(); }), b: b.slice(), note: "回代：x₃ = " + b[2] + " / (" + A[2][2] + ") = " + x[2], hot: [], piv: null, sol: [2] });
    x[1] = (b[1] - A[1][2] * x[2]) / A[1][1];
    stages.push({ A: A.map(function (r) { return r.slice(); }), b: b.slice(), note: "回代：x₂ = (" + b[1] + " − (" + A[1][2] + ")·(" + x[2] + ")) / " + A[1][1] + " = " + x[1], hot: [], piv: null, sol: [1, 2] });
    x[0] = (b[0] - A[0][1] * x[1] - A[0][2] * x[2]) / A[0][0];
    stages.push({ A: A.map(function (r) { return r.slice(); }), b: b.slice(), note: "回代：x₁ = (" + b[0] + " − 1·(" + x[1] + ") − (−1)·(" + x[2] + ")) / 2 = " + x[0] + "。解 x = (2, 3, −1)ᵀ", hot: [], piv: null, sol: [0, 1, 2] });
    var step = 0;
    var note = el("gauss-note"), luHost = el("gauss-lu");
    function fmt(v) { return Number.isInteger(v) ? String(v) : v.toFixed(2); }
    function matHTML(st) {
      var h = "<div class='matblock'><table>";
      for (var i = 0; i < 3; i++) {
        h += "<tr>";
        for (var j = 0; j < 3; j++) {
          var cls = "";
          if (st.piv && st.piv[0] === i && st.piv[1] === j) cls = "piv";
          else if (st.hot.indexOf(i) >= 0 && j >= i) cls = "hot";
          if (st.sol.indexOf(i) >= 0 && j === i) cls = "sol";
          h += "<td class='" + cls + "'>" + fmt(st.A[i][j]) + "</td>";
        }
        h += "<td style='color:var(--muted)'>|</td><td class='" + (st.sol.indexOf(i) >= 0 ? "sol" : (st.hot.indexOf(i) >= 0 ? "hot" : "")) + "'>" + fmt(st.b[i]) + "</td></tr>";
      }
      return h + "</table><div class='matlabel'>步骤 " + step + " / " + (stages.length - 1) + "</div></div>";
    }
    function render() {
      var st = stages[step];
      host.innerHTML = matHTML(st);
      note.textContent = st.note;
      if (step === stages.length - 1) {
        var Lh = "<div class='matblock'><table>";
        for (var i = 0; i < 3; i++) { Lh += "<tr>" + L[i].map(function (v) { return "<td>" + fmt(v) + "</td>"; }).join("") + "</tr>"; }
        var Uh = "<div class='matblock'><table>";
        for (var i2 = 0; i2 < 3; i2++) { Uh += "<tr>" + stages[2].A[i2].map(function (v) { return "<td>" + fmt(v) + "</td>"; }).join("") + "</tr>"; }
        luHost.innerHTML = "<div class='matflow'>" + Lh + "</table><div class='matlabel'>L（乘数）</div></div><div style='font-size:20px;color:var(--muted)'>×</div>" + Uh + "</table><div class='matlabel'>U（上三角）</div></div><div style='font-size:20px;color:var(--muted)'>= A</div></div>";
      } else luHost.innerHTML = "";
    }
    el("gauss-prev").addEventListener("click", function () { step = Math.max(0, step - 1); render(); });
    el("gauss-next").addEventListener("click", function () { step = Math.min(stages.length - 1, step + 1); render(); });
    render();
  })();

  /* =====================================================
     第4章 Demo A: Jacobi vs Gauss-Seidel 收敛路径
  ===================================================== */
  (function () {
    var cv = el("cv-iter");
    if (!cv) return;
    var A = [[3, 1], [1, 2]], bv = [5, 5], xs = [1, 2];
    var x0 = [4.2, -2.2];
    function jacobi(n) {
      var p = [x0[0], x0[1]], path = [p.slice()];
      for (var k = 0; k < n; k++) {
        var nx = (bv[0] - A[0][1] * p[1]) / A[0][0];
        var ny = (bv[1] - A[1][0] * p[0]) / A[1][1];
        p = [nx, ny]; path.push(p.slice());
      }
      return path;
    }
    function gs(n) {
      var p = [x0[0], x0[1]], path = [p.slice()];
      for (var k = 0; k < n; k++) {
        p[0] = (bv[0] - A[0][1] * p[1]) / A[0][0];
        p[1] = (bv[1] - A[1][0] * p[0]) / A[1][1];
        path.push(p.slice());
      }
      return path;
    }
    // A 的特征分解（对称 2x2）
    var tr = 5, det = 5, disc = Math.sqrt(tr * tr / 4 - det);
    var lam1 = tr / 2 + disc, lam2 = tr / 2 - disc;
    function eigvec(l) { var vx = 1, vy = l - A[0][0]; var n = Math.hypot(vx, vy); return [vx / n, vy / n]; }
    var e1 = eigvec(lam1), e2 = eigvec(lam2);
    var steps = 12;
    var slider = el("iter-steps"), sv = el("iter-stepsv"), rd = el("iter-read");
    function draw() {
      var n = parseInt(slider.value); sv.textContent = n;
      var c = themeColors(), g = ctx2d(cv, 340), ctx = g.ctx;
      var m = mapper(-3, 5, -3.2, 3.6, g.w, g.h, { l: 34, r: 14, t: 12, b: 26 });
      drawAxes(ctx, m, c, [-2, 0, 2, 4].map(function (v) { return { v: v, s: String(v) }; }),
        [-2, 0, 2].map(function (v) { return { v: v, s: String(v) }; }));
      // 等值椭圆 φ-φ* = c
      var c0 = 22;
      for (var li = 0; li < 7; li++) {
        var cc = c0 * Math.pow(0.38, li);
        ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.beginPath();
        for (var i = 0; i <= 120; i++) {
          var t = i / 120 * 2 * Math.PI;
          var rx = Math.sqrt(2 * cc / lam1) * Math.cos(t), ry = Math.sqrt(2 * cc / lam2) * Math.sin(t);
          var px = xs[0] + rx * e1[0] + ry * e2[0], py = xs[1] + rx * e1[1] + ry * e2[1];
          if (i === 0) ctx.moveTo(m.x(px), m.y(py)); else ctx.lineTo(m.x(px), m.y(py));
        }
        ctx.stroke();
      }
      var pj = jacobi(n), pg = gs(n);
      function path(p, col) {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
        p.forEach(function (q, i) { if (i === 0) ctx.moveTo(m.x(q[0]), m.y(q[1])); else ctx.lineTo(m.x(q[0]), m.y(q[1])); });
        ctx.stroke();
        ctx.fillStyle = col;
        p.forEach(function (q) { ctx.beginPath(); ctx.arc(m.x(q[0]), m.y(q[1]), 3, 0, 7); ctx.fill(); });
      }
      path(pj, c.s1); path(pg, c.s2);
      // 真解
      ctx.fillStyle = c.good; ctx.beginPath(); ctx.arc(m.x(xs[0]), m.y(xs[1]), 5, 0, 7); ctx.fill();
      ctx.fillStyle = c.muted; ctx.font = "11px sans-serif"; ctx.textAlign = "left";
      ctx.fillText("绿点 = 真解 x*=(1,2)；灰椭圆 = 二次型等值线", m.pad.l, m.pad.t + 2);
      var ej = Math.hypot(pj[n][0] - xs[0], pj[n][1] - xs[1]);
      var eg = Math.hypot(pg[n][0] - xs[0], pg[n][1] - xs[1]);
      rd.textContent =
        "迭代 " + n + " 步后：‖e_Jacobi‖ = " + ej.toExponential(2) + "    ‖e_GS‖ = " + eg.toExponential(2) + "\n" +
        "ρ(B_J) = √(1/6) ≈ 0.408    ρ(B_GS) = ρ(B_J)² ≈ 0.167（两点格式、一致排序 ⇒ GS 每步收益翻倍）\n" +
        "GS 的折线“每步直取当前超平面”，Jacobi 则同时用旧值 ⇒ 路径更绕。";
    }
    slider.addEventListener("input", draw);
    onThemeChange(draw);
    draw();
  })();

  /* =====================================================
     第4章 Demo B: SOR 谱半径曲线 ρ(ω)
  ===================================================== */
  (function () {
    var cv = el("cv-sor");
    if (!cv) return;
    // B_ω = (D-ωL)^{-1}[(1-ω)D+ωU]，A=[[3,1],[1,2]]
    function rhoSOR(w) {
      // M = D-ωL = [[3,0],[w,2]]; N = (1-w)D+wU = [[3(1-w), w],[0,2(1-w)]]
      var a11 = 3 * (1 - w), a12 = w, a22 = 2 * (1 - w);
      // B = M^{-1} N: M^{-1} = 1/6 * [[2,0],[-w,3]]
      var b11 = a11 / 3, b12 = a12 / 3;
      var b21 = -w * a11 / 6, b22 = (2 * a22 - w * a12) / 6;
      var tr = b11 + b22, det = b11 * b22 - b12 * b21;
      var d2 = tr * tr / 4 - det;
      if (d2 >= 0) return Math.max(Math.abs(tr / 2 + Math.sqrt(d2)), Math.abs(tr / 2 - Math.sqrt(d2)));
      return Math.sqrt(det); // 复根模 = sqrt(det)
    }
    var rhoJ = Math.sqrt(1 / 6);
    var wOpt = 2 / (1 + Math.sqrt(1 - rhoJ * rhoJ));
    var slider = el("sor-w"), sv = el("sor-wv"), rd = el("sor-read");
    function draw() {
      var c = themeColors(), g = ctx2d(cv, 260), ctx = g.ctx;
      var m = mapper(0, 2, 0, 1.05, g.w, g.h);
      drawAxes(ctx, m, c, [0, 0.5, 1, 1.5, 2].map(function (v) { return { v: v, s: String(v) }; }),
        [0, 0.25, 0.5, 0.75, 1].map(function (v) { return { v: v, s: String(v) }; }));
      ctx.strokeStyle = c.s1; ctx.lineWidth = 2; ctx.beginPath();
      for (var i = 0; i <= 200; i++) {
        var w = 0.02 + i / 200 * 1.96;
        var r = Math.min(rhoSOR(w), 1.05);
        if (i === 0) ctx.moveTo(m.x(w), m.y(r)); else ctx.lineTo(m.x(w), m.y(r));
      }
      ctx.stroke();
      // 最优点
      ctx.setLineDash([4, 4]); ctx.strokeStyle = c.good;
      ctx.beginPath(); ctx.moveTo(m.x(wOpt), m.y(0)); ctx.lineTo(m.x(wOpt), m.y(1.05)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.good; ctx.font = "11px sans-serif"; ctx.textAlign = "left";
      ctx.fillText("ω* ≈ " + wOpt.toFixed(3), m.x(wOpt) + 6, m.y(0.12));
      var w0 = parseFloat(slider.value);
      var r0 = rhoSOR(w0);
      ctx.fillStyle = c.s2; ctx.beginPath(); ctx.arc(m.x(w0), m.y(Math.min(r0, 1.05)), 5, 0, 7); ctx.fill();
      sv.textContent = w0.toFixed(2);
      rd.textContent =
        "ω = " + w0.toFixed(2) + "    ρ(B_ω) = " + r0.toFixed(4) + (r0 >= 1 ? "  ⚠ 不收敛（ρ ≥ 1）" : "") + "\n" +
        "ω=1 即 Gauss-Seidel（ρ≈0.167）；ω→最优值 " + wOpt.toFixed(3) + " 时 ρ 骤降到 " + (wOpt - 1).toFixed(4) + "；ω≥2 必发散。\n" +
        "渐近收敛速度 R = −ln ρ：最优 SOR 的 R 约为 GS 的 " + (Math.log(wOpt - 1) / Math.log(rhoJ * rhoJ)).toFixed(1) + " 倍。";
    }
    slider.addEventListener("input", draw);
    onThemeChange(draw);
    draw();
  })();

  /* =====================================================
     第5章: 求根方法赛跑（二分 / Newton / 弦截）
  ===================================================== */
  (function () {
    var cv = el("cv-root");
    if (!cv) return;
    var FUNS = {
      cos: { f: function (x) { return Math.cos(x) - x; }, df: function (x) { return -Math.sin(x) - 1; }, range: [-0.5, 1.8], iv: [0, 1], root: 0.7390851332, name: "cos x − x" },
      cub: { f: function (x) { return x * x * x - x - 2; }, df: function (x) { return 3 * x * x - 1; }, range: [1, 2], iv: [1, 2], root: 1.5213797068, name: "x³ − x − 2" },
      exp: { f: function (x) { return Math.exp(-x) - x; }, df: function (x) { return -Math.exp(-x) - 1; }, range: [-0.2, 1.5], iv: [0, 1], root: 0.5671432904, name: "e^(−x) − x" }
    };
    var fsel = el("root-f"), msel = el("root-m"), x0s = el("root-x0"), tbl = el("root-table"), rd = el("root-read");
    var steps = [];
    function compute() {
      var F = FUNS[fsel.value], m = msel.value, x0 = parseFloat(x0s.value);
      steps = [];
      if (m === "bis") {
        var a = F.iv[0], b = F.iv[1];
        for (var k = 0; k < 12; k++) {
          var c = (a + b) / 2, fc = F.f(c);
          steps.push({ k: k + 1, x: c, fx: fc, extra: "[" + a.toFixed(4) + ", " + b.toFixed(4) + "]" });
          if (F.f(a) * fc < 0) b = c; else a = c;
        }
      } else if (m === "newton") {
        var x = x0;
        for (var k2 = 0; k2 < 8; k2++) {
          var fx = F.f(x), dfx = F.df(x);
          steps.push({ k: k2, x: x, fx: fx, line: { x0: x, y0: fx, slope: dfx } });
          x = x - fx / dfx;
          if (!isFinite(x)) break;
        }
      } else {
        var xa = x0, xb = x0 + 0.4;
        for (var k3 = 0; k3 < 8; k3++) {
          var fa = F.f(xa), fb = F.f(xb);
          steps.push({ k: k3, x: xb, fx: fb, line: { x0: xa, y0: fa, slope: (fb - fa) / (xb - xa) } });
          var xn = xb - fb * (xb - xa) / (fb - fa);
          xa = xb; xb = xn;
          if (!isFinite(xb)) break;
        }
      }
      renderTable(F);
      draw();
    }
    function renderTable(F) {
      var h = "<table><tr><th>k</th><th>xₖ</th><th>f(xₖ)</th><th>误差 |xₖ−x*|</th></tr>";
      steps.forEach(function (s) {
        h += "<tr><td>" + s.k + "</td><td>" + s.x.toFixed(10) + "</td><td>" + s.fx.toExponential(2) + "</td><td>" + Math.abs(s.x - F.root).toExponential(2) + "</td></tr>";
      });
      tbl.innerHTML = h + "</table>";
      var m = msel.value;
      var ord = m === "bis" ? "线性（每步误差减半，q=1/2）" : m === "newton" ? "平方（误差约平方：10⁻²→10⁻⁴→10⁻⁸，看误差列指数翻倍）" : "超线性（阶 1.618）";
      rd.textContent = "方法收敛阶：" + ord + "　真根 x* ≈ " + F.root.toFixed(10);
    }
    function draw() {
      var F = FUNS[fsel.value];
      var c = themeColors(), g = ctx2d(cv, 300), ctx = g.ctx;
      var r = F.range;
      var ymin = -1, ymax = 1;
      for (var i = 0; i <= 100; i++) { var v = F.f(r[0] + (r[1] - r[0]) * i / 100); ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
      var pad = (ymax - ymin) * 0.12; ymin -= pad; ymax += pad;
      var m = mapper(r[0], r[1], ymin, ymax, g.w, g.h);
      drawAxes(ctx, m, c, [Math.ceil(r[0]), Math.ceil(r[0]) + 1, Math.ceil(r[0]) + 2].filter(function (v) { return v <= r[1]; }).map(function (v) { return { v: v, s: String(v) }; }),
        [0].map(function (v) { return { v: v, s: "0" }; }));
      // f 曲线
      ctx.strokeStyle = c.s1; ctx.lineWidth = 2; ctx.beginPath();
      for (var i2 = 0; i2 <= 200; i2++) {
        var x = r[0] + (r[1] - r[0]) * i2 / 200;
        if (i2 === 0) ctx.moveTo(m.x(x), m.y(F.f(x))); else ctx.lineTo(m.x(x), m.y(F.f(x)));
      }
      ctx.stroke();
      // 切线/割线
      ctx.lineWidth = 1.2;
      steps.forEach(function (s) {
        if (!s.line) return;
        ctx.strokeStyle = "rgba(235,104,52,0.45)";
        var L = s.line;
        var xa2 = r[0], xb2 = r[1];
        ctx.beginPath();
        ctx.moveTo(m.x(xa2), m.y(L.y0 + L.slope * (xa2 - L.x0)));
        ctx.lineTo(m.x(xb2), m.y(L.y0 + L.slope * (xb2 - L.x0)));
        ctx.stroke();
      });
      // 迭代点
      steps.forEach(function (s, i) {
        ctx.fillStyle = c.s2;
        ctx.beginPath(); ctx.arc(m.x(s.x), m.y(0), 3.5, 0, 7); ctx.fill();
      });
      // 根
      ctx.fillStyle = c.good; ctx.beginPath(); ctx.arc(m.x(F.root), m.y(0), 5, 0, 7); ctx.fill();
    }
    fsel.addEventListener("change", compute); msel.addEventListener("change", compute);
    x0s.addEventListener("input", compute);
    onThemeChange(draw);
    compute();
  })();

  /* =====================================================
     第6章: 最小二乘拟合（点击加点）
  ===================================================== */
  (function () {
    var cv = el("cv-lsq");
    if (!cv) return;
    var pts = [];
    function sample() {
      pts = [];
      var xs = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
      var noise = [0.6, -0.9, 0.4, -0.5, 0.8, -0.3, 0.7, -0.6, 0.2];
      xs.forEach(function (x, i) { pts.push([x, 0.3 * x * x - 0.5 * x + 1 + noise[i]]); });
    }
    sample();
    var degS = el("lsq-deg"), dv = el("lsq-degv"), rd = el("lsq-read");
    function solve(A, b) {
      var n = A.length;
      for (var i = 0; i < n; i++) {
        var mx = i;
        for (var k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[mx][i])) mx = k;
        var t = A[i]; A[i] = A[mx]; A[mx] = t; t = b[i]; b[i] = b[mx]; b[mx] = t;
        for (var k2 = i + 1; k2 < n; k2++) {
          var f = A[k2][i] / A[i][i];
          for (var j = i; j < n; j++) A[k2][j] -= f * A[i][j];
          b[k2] -= f * b[i];
        }
      }
      var x = new Array(n).fill(0);
      for (var i2 = n - 1; i2 >= 0; i2--) {
        var s = b[i2];
        for (var j2 = i2 + 1; j2 < n; j2++) s -= A[i2][j2] * x[j2];
        x[i2] = s / A[i2][i2];
      }
      return x;
    }
    var coef = null;
    function fit() {
      var d = parseInt(degS.value); dv.textContent = d;
      if (pts.length < d + 1) { coef = null; return; }
      var n = d + 1, G = [], rhs = [];
      for (var i = 0; i < n; i++) {
        G.push(new Array(n).fill(0)); rhs.push(0);
        for (var j = 0; j < n; j++) {
          var s = 0;
          pts.forEach(function (p) { s += Math.pow(p[0], i + j); });
          G[i][j] = s;
        }
        var sr = 0;
        pts.forEach(function (p) { sr += p[1] * Math.pow(p[0], i); });
        rhs[i] = sr;
      }
      coef = solve(G, rhs);
    }
    function draw() {
      fit();
      var c = themeColors(), g = ctx2d(cv, 300), ctx = g.ctx;
      var m = mapper(-5.5, 5.5, -2, 10, g.w, g.h, { l: 34, r: 12, t: 12, b: 24 });
      drawAxes(ctx, m, c, [-4, -2, 0, 2, 4].map(function (v) { return { v: v, s: String(v) }; }),
        [0, 2, 4, 6, 8].map(function (v) { return { v: v, s: String(v) }; }));
      if (coef) {
        ctx.strokeStyle = c.s1; ctx.lineWidth = 2; ctx.beginPath();
        for (var i = 0; i <= 200; i++) {
          var x = -5.5 + 11 * i / 200, y = 0;
          for (var k = 0; k < coef.length; k++) y += coef[k] * Math.pow(x, k);
          y = Math.max(-2, Math.min(10, y));
          if (i === 0) ctx.moveTo(m.x(x), m.y(y)); else ctx.lineTo(m.x(x), m.y(y));
        }
        ctx.stroke();
      }
      ctx.fillStyle = c.s2;
      pts.forEach(function (p) { ctx.beginPath(); ctx.arc(m.x(p[0]), m.y(p[1]), 4, 0, 7); ctx.fill(); });
      var res = 0;
      if (coef) {
        pts.forEach(function (p) {
          var y = 0;
          for (var k2 = 0; k2 < coef.length; k2++) y += coef[k2] * Math.pow(p[0], k2);
          res += (y - p[1]) * (y - p[1]);
        });
        res = Math.sqrt(res);
      }
      var d = parseInt(degS.value);
      rd.textContent = coef ?
        ("数据点 " + pts.length + " 个，拟合次数 m = " + d + "，残差 ‖r‖₂ = " + res.toFixed(4) +
          (d >= 6 ? "\n⚠ 次数升高：法方程条件数 ~κ(Hilbert) 爆炸，曲线开始为噪声抖动 ⇒ 这就是第 6 章要 QR/正交多项式的原因" : "") +
          (pts.length < 10 ? "\n（在画布上点击可继续添加数据点）" : "")) :
        "数据点不足（需 ≥ m+1 个），请降低次数或添加点";
    }
    cv.addEventListener("click", function (e) {
      var r = cv.getBoundingClientRect();
      var g = { w: r.width, h: 300 };
      var pad = { l: 34, r: 12, t: 12, b: 24 };
      var px = e.clientX - r.left, py = e.clientY - r.top;
      var x = -5.5 + (px - pad.l) / (g.w - pad.l - pad.r) * 11;
      var y = 10 - ((py - pad.t) / (g.h - pad.t - pad.b)) * 12;
      if (x < -5.5 || x > 5.5 || y < -2 || y > 10) return;
      pts.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
      draw();
    });
    el("lsq-clear").addEventListener("click", function () { pts = []; draw(); });
    el("lsq-sample").addEventListener("click", function () { sample(); draw(); });
    degS.addEventListener("input", draw);
    onThemeChange(draw);
    draw();
  })();

  /* =====================================================
     第7章: 幂法收敛
  ===================================================== */
  (function () {
    var cv = el("cv-power"), cv2 = el("cv-power-err");
    if (!cv) return;
    var th = 35 * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
    var l2s = el("pow-l2"), a0s = el("pow-a0"), rd = el("pow-read");
    function makeA(l2) {
      // A = R diag(1, l2) R^T
      return [
        [co * co + l2 * si * si, co * si * (1 - l2)],
        [co * si * (1 - l2), si * si + l2 * co * co]
      ];
    }
    function draw() {
      var l2 = parseFloat(l2s.value);
      el("pow-l2v").textContent = l2.toFixed(2);
      var a0 = parseFloat(a0s.value) * Math.PI / 180;
      el("pow-a0v").textContent = a0s.value + "°";
      var A = makeA(l2);
      var v = [Math.cos(a0), Math.sin(a0)];
      var iters = [v.slice()], mus = [];
      for (var k = 0; k < 24; k++) {
        var w = [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
        var mu = (v[0] * w[0] + v[1] * w[1]) / (v[0] * v[0] + v[1] * v[1]);
        mus.push(mu);
        var n = Math.hypot(w[0], w[1]);
        v = [w[0] / n, w[1] / n];
        iters.push(v.slice());
      }
      var c = themeColors(), g = ctx2d(cv, 280), ctx = g.ctx;
      var L = 1.35, m = mapper(-L, L, -L, L, g.w, g.h, { l: 16, r: 16, t: 12, b: 12 });
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(m.x(0), m.y(0), m.x(1) - m.x(0), 0, 7); ctx.stroke();
      // 特征方向
      ctx.strokeStyle = c.axis; ctx.setLineDash([4, 4]);
      [[co, si], [-si, co]].forEach(function (e) {
        ctx.beginPath(); ctx.moveTo(m.x(-1.3 * e[0]), m.y(-1.3 * e[1])); ctx.lineTo(m.x(1.3 * e[0]), m.y(1.3 * e[1])); ctx.stroke();
      });
      ctx.setLineDash([]);
      // 迭代箭头
      iters.forEach(function (p, i) {
        var a = i / iters.length;
        ctx.strokeStyle = "rgba(" + hexRgb(c.s1) + "," + (0.25 + 0.75 * a) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(m.x(0), m.y(0)); ctx.lineTo(m.x(p[0]), m.y(p[1])); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.arc(m.x(p[0]), m.y(p[1]), 3, 0, 7); ctx.fill();
      });
      // 误差曲线
      var g2 = ctx2d(cv2, 160), c2 = g2.ctx;
      var errs = mus.map(function (mu) { return Math.max(Math.abs(mu - 1), 1e-17); });
      var m2 = mapper(0, mus.length - 1, -16, 0.5, g2.w, g2.h, { l: 44, r: 12, t: 10, b: 24 });
      drawAxes(c2, m2, c, [0, 5, 10, 15, 20].map(function (v) { return { v: v, s: String(v) }; }),
        [-16, -12, -8, -4, 0].map(function (p) { return { v: p, s: "1e" + p }; }));
      c2.strokeStyle = c.s2; c2.lineWidth = 2; c2.beginPath();
      errs.forEach(function (e, i) {
        var ly = Math.log10(e);
        if (i === 0) c2.moveTo(m2.x(i), m2.y(ly)); else c2.lineTo(m2.x(i), m2.y(ly));
      });
      c2.stroke();
      // 理论斜率
      c2.strokeStyle = c.muted; c2.setLineDash([4, 4]); c2.beginPath();
      var slope = Math.log10(l2);
      c2.moveTo(m2.x(0), m2.y(Math.log10(errs[0])));
      c2.lineTo(m2.x(10), m2.y(Math.log10(errs[0]) + 10 * slope));
      c2.stroke(); c2.setLineDash([]);
      var need = Math.ceil(Math.log(1e-6) / Math.log(l2));
      rd.textContent =
        "λ₁=1, λ₂=" + l2.toFixed(2) + "，收敛比 |λ₂/λ₁| = " + l2.toFixed(2) +
        "，误差每步约 ×" + l2.toFixed(2) + "，达 1e-6 约需 " + need + " 步\n" +
        "虚线 = 理论衰减斜率 log₁₀|λ₂/λ₁|。λ₂→1 时收敛急剧变慢（虚线变平）——这就是要瑞利商加速/原点位移的原因。";
    }
    function hexRgb(hex) {
      var h = hex.replace("#", "");
      if (h.length === 3) h = h.split("").map(function (s) { return s + s; }).join("");
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)].join(",");
    }
    l2s.addEventListener("input", draw); a0s.addEventListener("input", draw);
    onThemeChange(draw);
    draw();
  })();

  /* =====================================================
     第8章: Runge 现象
  ===================================================== */
  (function () {
    var cv = el("cv-runge");
    if (!cv) return;
    var ns = el("runge-n"), mode = "eq", rd = el("runge-read");
    function f(x) { return 1 / (1 + 25 * x * x); }
    function baryW(xs) {
      var n = xs.length, w = new Array(n).fill(1);
      for (var j = 0; j < n; j++) {
        for (var i = 0; i < n; i++) if (i !== j) w[j] *= (xs[j] - xs[i]);
        w[j] = 1 / w[j];
      }
      return w;
    }
    function bary(xs, ys, w, x) {
      var num = 0, den = 0;
      for (var j = 0; j < xs.length; j++) {
        var d = x - xs[j];
        if (Math.abs(d) < 1e-13) return ys[j];
        var t = w[j] / d;
        num += t * ys[j]; den += t;
      }
      return num / den;
    }
    function draw() {
      var n = parseInt(ns.value);
      el("runge-nv").textContent = n;
      var xs = [], i;
      for (i = 0; i <= n; i++) {
        xs.push(mode === "eq" ? -1 + 2 * i / n : Math.cos(i * Math.PI / n));
      }
      var ys = xs.map(f), w = baryW(xs);
      var c = themeColors(), g = ctx2d(cv, 320), ctx = g.ctx;
      var m = mapper(-1.05, 1.05, -0.5, 1.6, g.w, g.h);
      drawAxes(ctx, m, c, [-1, -0.5, 0, 0.5, 1].map(function (v) { return { v: v, s: String(v) }; }),
        [-0.5, 0, 0.5, 1, 1.5].map(function (v) { return { v: v, s: String(v) }; }));
      // 插值曲线
      var maxErr = 0;
      ctx.strokeStyle = c.s2; ctx.lineWidth = 2; ctx.beginPath();
      var prevBad = false;
      for (i = 0; i <= 400; i++) {
        var x = -1 + 2 * i / 400;
        var p = bary(xs, ys, w, x);
        maxErr = Math.max(maxErr, Math.abs(p - f(x)));
        var pc = Math.max(-0.5, Math.min(1.6, p));
        if (Math.abs(p) > 3) { prevBad = true; continue; }
        if (i === 0 || prevBad) { ctx.moveTo(m.x(x), m.y(pc)); prevBad = false; } else ctx.lineTo(m.x(x), m.y(pc));
      }
      ctx.stroke();
      // 原函数
      ctx.strokeStyle = c.s1; ctx.lineWidth = 2; ctx.beginPath();
      for (i = 0; i <= 300; i++) {
        var x2 = -1.05 + 2.1 * i / 300;
        if (i === 0) ctx.moveTo(m.x(x2), m.y(f(x2))); else ctx.lineTo(m.x(x2), m.y(f(x2)));
      }
      ctx.stroke();
      // 节点
      ctx.fillStyle = c.ink;
      xs.forEach(function (x3) { ctx.beginPath(); ctx.arc(m.x(x3), m.y(f(x3)), 3.5, 0, 7); ctx.fill(); });
      rd.textContent =
        "节点数 n+1 = " + (n + 1) + "（" + (mode === "eq" ? "等距" : "Chebyshev") + "）　全网格最大误差 ≈ " + fmtExp(maxErr) + "\n" +
        (mode === "eq"
          ? (n >= 14 ? "⚠ 等距高次插值在端点剧烈振荡且随 n 发散 —— Runge 现象。切到 Chebyshev 节点对比！" : "拖动 n 到 16 以上，观察端点附近橙色曲线开始发散。")
          : "Chebyshev 节点向端点加密，误差在全区间均匀受控（一致收敛）——节点分布本身就是药方。");
    }
    ns.addEventListener("input", draw);
    document.querySelectorAll("#runge-seg button").forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.dataset.m;
        document.querySelectorAll("#runge-seg button").forEach(function (x) { x.classList.toggle("on", x === b); });
        draw();
      });
    });
    onThemeChange(draw);
    draw();
  })();

  /* =====================================================
     第9章: Chebyshev 多项式 + 节点多项式对比
  ===================================================== */
  (function () {
    var cv = el("cv-cheb"), cv2 = el("cv-omega");
    if (!cv) return;
    var ns = el("cheb-n");
    function T(n, x) {
      if (Math.abs(x) <= 1) return Math.cos(n * Math.acos(Math.max(-1, Math.min(1, x))));
      return Math.cosh(n * (Math.log(Math.abs(x) + Math.sqrt(x * x - 1)))) * (x >= 0 ? 1 : (n % 2 ? -1 : 1));
    }
    function draw() {
      var n = parseInt(ns.value);
      el("cheb-nv").textContent = n;
      var c = themeColors(), g = ctx2d(cv, 260), ctx = g.ctx;
      var m = mapper(-1.1, 1.1, -1.25, 1.25, g.w, g.h);
      drawAxes(ctx, m, c, [-1, -0.5, 0, 0.5, 1].map(function (v) { return { v: v, s: String(v) }; }),
        [-1, -0.5, 0, 0.5, 1].map(function (v) { return { v: v, s: String(v) }; }));
      ctx.strokeStyle = c.s1; ctx.lineWidth = 2; ctx.beginPath();
      for (var i = 0; i <= 400; i++) {
        var x = -1.1 + 2.2 * i / 400;
        var y = Math.max(-1.25, Math.min(1.25, T(n, x)));
        if (i === 0) ctx.moveTo(m.x(x), m.y(y)); else ctx.lineTo(m.x(x), m.y(y));
      }
      ctx.stroke();
      // 交错点
      ctx.fillStyle = c.s2;
      for (var k = 0; k <= n; k++) {
        var xk = Math.cos(k * Math.PI / n);
        ctx.beginPath(); ctx.arc(m.x(xk), m.y(T(n, xk)), 3.5, 0, 7); ctx.fill();
      }
      // 零点
      ctx.fillStyle = c.s3;
      for (var k2 = 0; k2 < n; k2++) {
        var xz = Math.cos((2 * k2 + 1) * Math.PI / (2 * n));
        ctx.beginPath(); ctx.arc(m.x(xz), m.y(0), 3, 0, 7); ctx.fill();
      }
      // omega 对比图（n=8 固定）
      var nn = 8;
      var g2 = ctx2d(cv2, 200), c2 = g2.ctx;
      function omega(nodes, x) {
        var p = 1;
        nodes.forEach(function (t) { p *= (x - t); });
        return Math.abs(p);
      }
      var eq = [], ch = [];
      for (var j = 0; j <= nn; j++) { eq.push(-1 + 2 * j / nn); ch.push(Math.cos(j * Math.PI / nn)); }
      var ymax = 0, i2;
      var vals = { eq: [], ch: [] };
      for (i2 = 0; i2 <= 300; i2++) {
        var x3 = -1 + 2 * i2 / 300;
        vals.eq.push(omega(eq, x3)); vals.ch.push(omega(ch, x3));
        ymax = Math.max(ymax, vals.eq[i2]);
      }
      var m2 = mapper(-1, 1, 0, ymax * 1.1, g2.w, g2.h, { l: 40, r: 12, t: 10, b: 24 });
      drawAxes(c2, m2, c, [-1, 0, 1].map(function (v) { return { v: v, s: String(v) }; }),
        [0, ymax / 2, ymax].map(function (v) { return { v: v, s: fmtExp(v) }; }));
      function pl(arr, col) {
        c2.strokeStyle = col; c2.lineWidth = 2; c2.beginPath();
        arr.forEach(function (v, i4) {
          var x4 = -1 + 2 * i4 / 300;
          if (i4 === 0) c2.moveTo(m2.x(x4), m2.y(v)); else c2.lineTo(m2.x(x4), m2.y(v));
        });
        c2.stroke();
      }
      pl(vals.eq, c.s2); pl(vals.ch, c.s3);
      c2.fillStyle = c.muted; c2.font = "11px sans-serif"; c2.textAlign = "left";
      c2.fillText("|ω(x)|：等距节点(橙) vs Chebyshev 节点(绿)，n=8", m2.pad.l, m2.pad.t + 4);
      el("cheb-read").textContent =
        "T_" + n + "(x) 在 [−1,1] 上 n+1 个交错点(橙)处轮流取 ±1，n 个零点(绿) = 最佳插值节点。\n" +
        "T_n/2^(n−1) 是首一 n 次多项式中一致范数最小的（=1/2^(n−1)）⇒ 用其零点插值可使余项里的 ‖ω‖∞ 最小。";
    }
    ns.addEventListener("input", draw);
    onThemeChange(draw);
    draw();
  })();

  /* =====================================================
     第10章: 复化求积 + Romberg
  ===================================================== */
  (function () {
    var cv = el("cv-quad"), cv2 = el("cv-quad-err");
    if (!cv) return;
    var FUNS = {
      sin: { f: function (x) { return Math.sin(x); }, a: 0, b: Math.PI, exact: 2, name: "sin x, [0,π]" },
      r4: { f: function (x) { return 1 / (1 + x * x); }, a: 0, b: 1, exact: Math.PI / 4, name: "1/(1+x²), [0,1]" },
      ex: { f: function (x) { return Math.exp(x); }, a: 0, b: 1, exact: Math.E - 1, name: "eˣ, [0,1]" }
    };
    var fsel = el("quad-f"), ns = el("quad-n"), rd = el("quad-read"), rt = el("romberg-table");
    var method = "trap";
    function trap(F, n) {
      var h = (F.b - F.a) / n, s = (F.f(F.a) + F.f(F.b)) / 2;
      for (var i = 1; i < n; i++) s += F.f(F.a + i * h);
      return s * h;
    }
    function simp(F, n) {
      if (n % 2) n++;
      var h = (F.b - F.a) / n, s = F.f(F.a) + F.f(F.b);
      for (var i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * F.f(F.a + i * h);
      return s * h / 3;
    }
    function draw() {
      var F = FUNS[fsel.value], n = parseInt(ns.value);
      el("quad-nv").textContent = n;
      var c = themeColors(), g = ctx2d(cv, 280), ctx = g.ctx;
      var ymin = Math.min(0, F.f(F.a)), ymax = 0;
      for (var i = 0; i <= 100; i++) ymax = Math.max(ymax, F.f(F.a + (F.b - F.a) * i / 100));
      ymax *= 1.12;
      var m = mapper(F.a, F.b, ymin, ymax, g.w, g.h);
      var xt = [F.a, (F.a + F.b) / 2, F.b].map(function (v) { return { v: v, s: v.toFixed(2) }; });
      drawAxes(ctx, m, c, xt, [0, ymax / 2, ymax].map(function (v) { return { v: v, s: v.toFixed(2) }; }));
      // 求积区域
      var h = (F.b - F.a) / n;
      ctx.fillStyle = "rgba(42,120,214,0.16)"; ctx.strokeStyle = "rgba(42,120,214,0.5)"; ctx.lineWidth = 1;
      for (i = 0; i < n; i++) {
        var x0 = F.a + i * h, x1 = x0 + h;
        ctx.beginPath();
        ctx.moveTo(m.x(x0), m.y(0));
        ctx.lineTo(m.x(x0), m.y(F.f(x0)));
        ctx.lineTo(m.x(x1), m.y(F.f(x1)));
        ctx.lineTo(m.x(x1), m.y(0));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // f 曲线
      ctx.strokeStyle = c.s1; ctx.lineWidth = 2; ctx.beginPath();
      for (i = 0; i <= 200; i++) {
        var x = F.a + (F.b - F.a) * i / 200;
        if (i === 0) ctx.moveTo(m.x(x), m.y(F.f(x))); else ctx.lineTo(m.x(x), m.y(F.f(x)));
      }
      ctx.stroke();
      // 误差收敛曲线
      var g2 = ctx2d(cv2, 200), c2 = g2.ctx;
      var ns2 = [], et = [], es = [];
      for (var k = 1; k <= 6; k++) {
        var nn = Math.pow(2, k);
        ns2.push(nn);
        et.push(Math.max(Math.abs(trap(F, nn) - F.exact), 1e-17));
        es.push(Math.max(Math.abs(simp(F, nn) - F.exact), 1e-17));
      }
      var m2 = mapper(1, 64, -17, 1, g2.w, g2.h, { l: 44, r: 12, t: 10, b: 24 });
      // 横轴用 log2(n)
      function mx(v) { return m2.pad.l + Math.log2(v) / 6 * (g2.w - m2.pad.l - m2.pad.r); }
      function my(v) { return m2.y(v); }
      drawAxes(c2, m2, c, [], [-16, -12, -8, -4, 0].map(function (p) { return { v: p, s: "1e" + p }; }));
      c2.fillStyle = c.muted; c2.font = "10px ui-monospace, monospace"; c2.textAlign = "center";
      [2, 8, 32, 64].forEach(function (v) { c2.fillText("n=" + v, mx(v), g2.h - m2.pad.b + 14); });
      function pl2(arr, col) {
        c2.strokeStyle = col; c2.lineWidth = 2; c2.beginPath();
        arr.forEach(function (e, i3) {
          var X = mx(ns2[i3]), Y = my(Math.log10(e));
          if (i3 === 0) c2.moveTo(X, Y); else c2.lineTo(X, Y);
        });
        c2.stroke();
      }
      pl2(et, c.s2); pl2(es, c.s3);
      c2.fillStyle = c.muted; c2.textAlign = "left";
      c2.fillText("误差 vs n：梯形(橙, O(h²)) / Simpson(绿, O(h⁴))", m2.pad.l, m2.pad.t + 4);
      // 数值结果
      var vt = trap(F, n), vs = simp(F, n);
      rd.textContent =
        "n = " + n + "　复化梯形 = " + vt.toFixed(10) + "（误差 " + Math.abs(vt - F.exact).toExponential(2) + "）\n" +
        "复化 Simpson = " + vs.toFixed(10) + "（误差 " + Math.abs(vs - F.exact).toExponential(2) + "）　精确值 = " + F.exact.toFixed(10);
      // Romberg 表
      var R = [], L = 5;
      for (var k2 = 0; k2 < L; k2++) {
        R.push([trap(F, Math.pow(2, k2))]);
        for (var j = 1; j <= k2; j++) {
          R[k2].push(R[k2][j - 1] + (R[k2][j - 1] - R[k2 - 1][j - 1]) / (Math.pow(4, j) - 1));
        }
      }
      var hh = "<table><tr><th>区间数 2ᵏ</th><th>T（梯形）</th><th>S（1次外推）</th><th>C（2次）</th><th>R（3次）</th><th>4次外推</th></tr>";
      for (var k3 = 0; k3 < L; k3++) {
        hh += "<tr><td>" + Math.pow(2, k3) + "</td>";
        for (var j2 = 0; j2 < L; j2++) {
          hh += "<td>" + (j2 <= k3 ? R[k3][j2].toFixed(10) : "") + "</td>";
        }
        hh += "</tr>";
      }
      rt.innerHTML = hh + "</table><div style='font-size:12px;color:var(--muted);margin-top:4px'>对角线右下端 = Romberg 最优估计，每往右一列误差阶提高 2 阶（O(h⁴)→O(h⁶)→…）</div>";
    }
    fsel.addEventListener("change", draw); ns.addEventListener("input", draw);
    onThemeChange(draw);
    draw();
  })();

  /* =====================================================
     第11章: 稳定性实验场  y'=-λy
  ===================================================== */
  (function () {
    var cv = el("cv-ode");
    if (!cv) return;
    var zs = el("ode-z"), rd = el("ode-read");
    var use = { eu: true, he: true, rk: true };
    function R_eu(z) { return 1 - z; }
    function R_he(z) { return 1 - z + z * z / 2; }
    function R_rk(z) { return 1 - z + z * z / 2 - z * z * z / 6 + Math.pow(z, 4) / 24; }
    function draw() {
      var z = parseFloat(zs.value);
      el("ode-zv").textContent = z.toFixed(2);
      var T = 6, N = Math.max(1, Math.round(T / z)), h = T / N;
      var c = themeColors(), g = ctx2d(cv, 320), ctx = g.ctx;
      var ymin = -1.6, ymax = 1.5;
      var m = mapper(0, T, ymin, ymax, g.w, g.h);
      drawAxes(ctx, m, c, [0, 1, 2, 3, 4, 5, 6].map(function (v) { return { v: v, s: String(v) }; }),
        [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map(function (v) { return { v: v, s: String(v) }; }));
      // 精确解
      ctx.strokeStyle = c.s1; ctx.lineWidth = 2; ctx.beginPath();
      for (var i = 0; i <= 300; i++) {
        var t = T * i / 300;
        if (i === 0) ctx.moveTo(m.x(t), m.y(Math.exp(-t))); else ctx.lineTo(m.x(t), m.y(Math.exp(-t)));
      }
      ctx.stroke();
      function sol(R, col) {
        var y = 1;
        ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.beginPath();
        ctx.moveTo(m.x(0), m.y(y));
        var yy = [];
        for (var k = 1; k <= N; k++) {
          y *= R(z);
          var yc = Math.max(ymin, Math.min(ymax, y));
          ctx.lineTo(m.x(k * h), m.y(yc));
          yy.push(y);
        }
        ctx.stroke();
        return y;
      }
      var msg = "z = λh = " + z.toFixed(2) + "，积分到 t = " + T + "\n";
      if (use.eu) { var ye = sol(R_eu, c.s2); msg += "Euler：|1−z| = " + Math.abs(R_eu(z)).toFixed(3) + (z > 2 ? " > 1 ⚠ 振荡发散" : " < 1 ✓ 稳定") + "，末端值 " + ye.toExponential(2) + "\n"; }
      if (use.he) { var yh = sol(R_he, c.s7); msg += "改进Euler：稳定域同 z<2" + (z > 2 ? "（当前发散）" : "（当前稳定）") + "，末端值 " + yh.toExponential(2) + "\n"; }
      if (use.rk) { var yr = sol(R_rk, c.s3); msg += "RK4：z<2.785 稳定" + (z > 2.785 ? "（当前发散！）" : "（当前稳定）") + "，末端值 " + yr.toExponential(2) + "\n"; }
      msg += "精确解末端 e⁻⁶ ≈ 0.00248。拖动 z 越过 2 和 2.785，亲眼看显式格式逐个爆炸 —— 刚性方程必须换隐式格式。";
      rd.textContent = msg;
    }
    zs.addEventListener("input", draw);
    ["eu", "he", "rk"].forEach(function (k) {
      el("ode-" + k).addEventListener("change", function () { use[k] = this.checked; draw(); });
    });
    onThemeChange(draw);
    draw();
  })();

  /* =====================================================
     自测题
  ===================================================== */
  var QUIZ = [
    { q: "‖A‖₁ 与 ‖A‖∞ 分别是？", o: ["最大行和 / 最大列和", "最大列和 / 最大行和", "都是最大行和", "都是谱半径"], a: 1, w: "‖A‖₁=最大列和，‖A‖∞=最大行和 —— 恰好与直觉相反，是考试第一坑。" },
    { q: "ρ(A) ≤ ‖A‖ 在什么情况下取等号？", o: ["永远取等", "A 对称且取 2-范数时", "A 可逆时", "取 1-范数时"], a: 1, w: "一般只是单边不等式；对称矩阵的谱半径等于谱范数 ‖A‖₂。" },
    { q: "残差 r = b − Ax̃ 很小，能说明解很准吗？", o: ["能，残差小即误差小", "不能，A 病态时误差仍可很大", "只要用双精度就能", "仅当 A 奇异时不能"], a: 1, w: "‖e‖/‖x‖ ≤ κ(A)·‖r‖/‖b‖：病态矩阵会把小残差放大成大误差。" },
    { q: "等距节点上提高插值多项式次数，效果通常？", o: ["越来越准", "端点出现 Runge 振荡甚至发散", "误差不变", "只对三角函数发散"], a: 1, w: "Runge 现象：等距高次插值在区间端点剧烈振荡。改用 Chebyshev 节点或分段低次/样条。" },
    { q: "数值微分中步长 h 越小越好吗？", o: ["是，h→0 误差→0", "否，舍入误差 ~ε/h 会爆炸，存在最优 h*", "只与机器有关", "只要中心差分就无所谓"], a: 1, w: "截断误差 ~hᵖ 与舍入误差 ~ε/h 互相拉扯，最优 h*≈ε^(1/(p+1))。" },
    { q: "Newton 法平方收敛的条件是？", o: ["任何初值都行", "单根且初值充分接近", "只要 f 连续", "重根时也平方收敛"], a: 1, w: "重根时退化为线性收敛，收敛比 (m−1)/m；可用修正 Newton x−m·f/f′ 恢复二阶。" },
    { q: "显式 Runge-Kutta 方法可以是 A-稳定的吗？", o: ["阶数足够高就可以", "任何显式 RK 都不是 A-稳定的", "RK4 是 A-稳定的", "加上步长控制就是"], a: 1, w: "所有显式 RK 的稳定域都是左半平面的有界区域；刚性方程必须用隐式方法（如隐式 Euler、梯形法）。" },
    { q: "迭代法 x⁽ᵏ⁺¹⁾=Bx⁽ᵏ⁾+g 对任意初值收敛的充要条件？", o: ["‖B‖<1", "ρ(B)<1", "B 对称", "A 对角占优"], a: 1, w: "‖B‖<1 只是充分条件；充要条件是谱半径 ρ(B)<1。对角占优也只是充分条件。" },
    { q: "复化 Simpson 公式的余项是？", o: ["−(b−a)/12 · h²f″(η)", "−(b−a)/180 · h⁴f⁽⁴⁾(η)", "−(b−a)/180 · (h/2)⁴f⁽⁴⁾(η)", "−(b−a)/288 · h⁴f⁽⁴⁾(η)"], a: 1, w: "注意是 h⁴ 而不是 (h/2)⁴ —— 写错差 16 倍。h=(b−a)/n。" },
    { q: "近似值 0.003400 有几位有效数字？", o: ["2 位", "4 位", "6 位", "3 位"], a: 1, w: "从第一个非零数字 3 数起：3、4、0、0 共 4 位，末尾的 0 也算。" }
  ];
  (function () {
    var host = el("quiz-host");
    if (!host) return;
    var score = { ok: 0, done: 0 };
    var saved = store.get("na-quiz", {});
    QUIZ.forEach(function (q, qi) {
      var div = document.createElement("div");
      div.className = "quiz-q";
      var opts = q.o.map(function (o, oi) {
        return "<button class='opt' data-i='" + oi + "'>" + String.fromCharCode(65 + oi) + ". " + o + "</button>";
      }).join("");
      div.innerHTML = "<div class='qq'><span class='qno'>Q" + (qi + 1) + "</span>" + q.q + "</div><div class='opts'>" + opts + "</div><div class='why-line'>✦ " + q.w + "</div>";
      host.appendChild(div);
      function mark(chosen) {
        div.classList.add("answered");
        div.querySelectorAll(".opt").forEach(function (b) {
          var i = parseInt(b.dataset.i);
          b.disabled = true;
          if (i === q.a) b.classList.add("correct");
          else if (i === chosen) b.classList.add("wrong");
        });
      }
      if (saved[qi] !== undefined) {
        mark(saved[qi]);
        score.done++; if (saved[qi] === q.a) score.ok++;
      }
      div.addEventListener("click", function (e) {
        var b = e.target.closest(".opt");
        if (!b || div.classList.contains("answered")) return;
        var i = parseInt(b.dataset.i);
        saved[qi] = i; store.set("na-quiz", saved);
        mark(i);
        score.done++; if (i === q.a) score.ok++;
        updScore();
      });
    });
    function updScore() {
      var s = el("quiz-score");
      if (s) s.textContent = "已答 " + score.done + " / " + QUIZ.length + "　答对 " + score.ok + " 题";
    }
    updScore();
  })();

  /* ---------------- 窗口尺寸变化重绘 ---------------- */
  var rsz;
  window.addEventListener("resize", function () {
    clearTimeout(rsz);
    rsz = setTimeout(function () { redrawAll.forEach(function (f) { f(); }); }, 200);
  });
})();
