/* Infinite Financial Group — interaction engine (vanilla, no dependencies) */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduce) root.classList.add('reduce');
  else root.style.scrollBehavior = 'smooth';

  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var scrollY = window.scrollY;
  var lastScrollY = scrollY;
  var velocity = 0;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function pageTop(el) { return el.getBoundingClientRect().top + window.scrollY; }
  function pad3(n) { return (n < 10 ? '00' : n < 100 ? '0' : '') + n; }

  /* ------------------------------------------------------------------
     Film: a frame sequence drawn to canvas, scrubbed by scroll.
     Frames load in passes (every 16th, 8th, 4th, 2nd, then all), so the
     whole film is scrubbable early and sharpens as the rest arrive.
     ------------------------------------------------------------------ */
  function Film(section) {
    this.section = section;
    this.name = section.getAttribute('data-film');
    this.count = parseInt(section.getAttribute('data-frames'), 10);
    this.canvas = $('.film-canvas', section);
    this.ctx = this.canvas.getContext('2d');
    this.host = this.canvas.parentElement;
    this.frames = [];
    this.current = 0;
    this.target = 0;
    this.drawn = -1;
    this.started = false;
    this.ready = false;
    this.variant = null;
    this.firstPass = 0;
    this.loadedCount = 0;
  }
  Film.prototype.pickVariant = function () {
    return (vw < 760 && vh > vw) ? 'mobile' : 'desktop';
  };
  Film.prototype.src = function (i) {
    return 'assets/film/' + this.name + '/' + this.variant + '/f' + pad3(i + 1) + '.jpg';
  };
  Film.prototype.load = function (onProgress, onFirstPass) {
    if (this.started) return;
    this.started = true;
    this.variant = this.pickVariant();
    this.frames = new Array(this.count);
    var self = this;
    var order = [];
    var seen = {};
    [16, 8, 4, 2, 1].forEach(function (step, pass) {
      for (var i = 0; i < self.count; i += step) {
        if (!seen[i]) { seen[i] = 1; order.push(i); }
      }
      if (pass === 0) {
        if (!seen[self.count - 1]) { seen[self.count - 1] = 1; order.push(self.count - 1); }
        self.firstPass = order.length;
      }
    });
    var inflight = 0;
    var cursor = 0;
    var firstDone = false;
    var batch = this.variant;
    function pump() {
      while (inflight < 6 && cursor < order.length) {
        (function (i) {
          var img = new Image();
          img.decoding = 'async';
          inflight++;
          img.onload = img.onerror = function (e) {
            inflight--;
            if (batch !== self.variant) return;
            if (e.type === 'load') self.frames[i] = img;
            self.loadedCount++;
            if (onProgress) onProgress(Math.min(1, self.loadedCount / self.firstPass));
            if (!firstDone && self.loadedCount >= self.firstPass) {
              firstDone = true;
              if (onFirstPass) onFirstPass();
            }
            self.drawn = -1;
            pump();
          };
          img.src = self.src(i);
        })(order[cursor++]);
      }
    }
    pump();
  };
  Film.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = this.canvas.clientWidth;
    var h = this.canvas.clientHeight;
    var scale = Math.min(dpr, 1920 / Math.max(w, 1));
    this.canvas.width = Math.max(1, Math.round(w * scale));
    this.canvas.height = Math.max(1, Math.round(h * scale));
    this.drawn = -1;
    if (this.started && this.pickVariant() !== this.variant) {
      this.started = false;
      this.loadedCount = 0;
      this.load();
    }
  };
  Film.prototype.nearest = function (i) {
    if (this.frames[i]) return i;
    for (var d = 1; d < this.count; d++) {
      if (i - d >= 0 && this.frames[i - d]) return i - d;
      if (i + d < this.count && this.frames[i + d]) return i + d;
    }
    return -1;
  };
  Film.prototype.render = function () {
    var want = Math.round(this.current * (this.count - 1));
    var n = this.nearest(want);
    if (n < 0) return -1;
    if (n !== this.drawn) {
      var img = this.frames[n];
      var c = this.canvas;
      var s = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
      var w = img.naturalWidth * s;
      var h = img.naturalHeight * s;
      this.ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
      this.drawn = n;
      if (!this.ready) { this.ready = true; this.host.classList.add('film-ready'); }
    }
    return n;
  };

  /* ------------------------------------------------------------------
     Elements
     ------------------------------------------------------------------ */
  var nav = $('#nav');
  var meter = $('#infMeter');
  var meterLen = meter.getTotalLength();
  meter.style.strokeDasharray = meterLen;
  meter.style.strokeDashoffset = meterLen;

  var hero = $('.hero');
  var heroStage = $('.hero-stage');
  var heroFilm = new Film(hero);
  var frameNo = $('#frameNo');
  $('#frameTotal').textContent = pad3(heroFilm.count);
  var rail = $('.hud-rail');
  var railItems = $$('.hud-rail li');
  var chapters = $$('.chapter', hero).map(function (el) {
    return {
      el: el,
      a: parseFloat(el.getAttribute('data-in')),
      b: parseFloat(el.getAttribute('data-out')),
      id: parseInt(el.getAttribute('data-chapter-id') || '0', 10),
      o: -1
    };
  });

  var contact = $('#contact');
  var contactFilm = new Film(contact);

  var dustCanvas = $('#dust');
  var ticker = $('#ticker');

  /* ------------------------------------------------------------------
     Preloader
     ------------------------------------------------------------------ */
  var loaderDraw = $('#loaderDraw');
  var loaderPct = $('#loaderPct');
  var loaderLen = loaderDraw.getTotalLength();
  loaderDraw.style.strokeDasharray = loaderLen;
  loaderDraw.style.strokeDashoffset = loaderLen;
  var loaderShown = 0;
  var loaderTarget = 0;
  var loaded = false;

  function finishLoading() {
    if (loaded) return;
    loaded = true;
    loaderTarget = 1;
    setTimeout(function () {
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-loaded');
    }, 380);
  }

  if (reduce) {
    finishLoading();
  } else {
    heroFilm.load(function (p) { loaderTarget = Math.max(loaderTarget, p); }, finishLoading);
    setTimeout(finishLoading, 7000);
  }

  /* ------------------------------------------------------------------
     Layout cache (recomputed on resize)
     ------------------------------------------------------------------ */
  var L = {};
  var services = $('#services');
  var railTrack = $('#railTrack');
  var railEl = $('#rail');
  var railNow = $('#railNow');
  var railBar = $('#railBar');
  var svcCards = $$('.svc', railTrack);
  var pinRail = false;

  function measure() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    heroFilm.resize();
    contactFilm.resize();

    pinRail = !reduce && vw >= 900;
    services.classList.toggle('is-pinned', pinRail);
    if (pinRail) {
      railTrack.style.transform = 'none';
      var distance = Math.max(0, railTrack.scrollWidth - vw);
      L.railDistance = distance;
      services.style.setProperty('--rail-h', (distance + vh * 1.15) + 'px');
    } else {
      railTrack.style.transform = '';
      services.style.removeProperty('--rail-h');
    }

    L.heroTop = pageTop(hero);
    L.heroH = hero.offsetHeight;
    L.servicesTop = pageTop(services);
    L.servicesH = services.offsetHeight;
    L.docH = document.documentElement.scrollHeight;
    L.tickerHalf = ticker.scrollWidth / 2;
    var selTab = document.querySelector('.lab-tabs [aria-selected=true]');
    if (selTab && tabGlow) placeGlow(selTab);
    sizeDust();
  }

  /* ------------------------------------------------------------------
     Ticker (doubles its content so it can loop seamlessly)
     ------------------------------------------------------------------ */
  ticker.innerHTML += ticker.innerHTML;
  var tickerX = 0;
  var tickerSkew = 0;

  /* ------------------------------------------------------------------
     Scroll-lit statement
     ------------------------------------------------------------------ */
  var lit = $('[data-lit]');
  var litWords = [];
  (function splitLit() {
    var words = lit.textContent.trim().split(/\s+/);
    var goldFrom = words.indexOf('understanding');
    lit.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'w' + (goldFrom > -1 && i >= goldFrom ? ' is-gold' : '');
      s.textContent = w;
      lit.appendChild(s);
      lit.appendChild(document.createTextNode(' '));
      litWords.push(s);
    });
  })();
  var litCount = -1;

  /* ------------------------------------------------------------------
     Mission: per-word mask reveal
     ------------------------------------------------------------------ */
  var quote = $('[data-words]');
  (function splitQuote() {
    var i = 0;
    function wrap(node) {
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        var w = document.createElement('span');
        w.className = 'w';
        var inner = document.createElement('span');
        inner.textContent = part;
        inner.style.setProperty('--i', i++);
        w.appendChild(inner);
        frag.appendChild(w);
      });
      return frag;
    }
    Array.prototype.slice.call(quote.childNodes).forEach(function (n) {
      if (n.nodeType === 3) quote.replaceChild(wrap(n), n);
      else if (n.nodeType === 1) {
        Array.prototype.slice.call(n.childNodes).forEach(function (c) {
          if (c.nodeType === 3) n.replaceChild(wrap(c), c);
        });
      }
    });
    quote.classList.add('is-split');
  })();

  /* ------------------------------------------------------------------
     Reveal on scroll + current-section highlight
     ------------------------------------------------------------------ */
  if ('IntersectionObserver' in window) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal]').forEach(function (el) { revealIO.observe(el); });

    var quoteIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { quote.classList.add('is-in'); quoteIO.disconnect(); } });
    }, { threshold: 0.35 });
    quoteIO.observe(quote);

    var navLinks = $$('.nav-links a');
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle('is-current', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['about', 'services', 'lab', 'mission', 'contact'].forEach(function (id) { navIO.observe(document.getElementById(id)); });
  } else {
    $$('[data-reveal]').forEach(function (el) { el.classList.add('is-in'); });
    quote.classList.add('is-in');
  }

  /* ------------------------------------------------------------------
     What you can expect: comet on the infinity
     ------------------------------------------------------------------ */
  var eiPath = $('#eiPath');
  var eiTrail = $('#eiTrail');
  var eiComet = $('#eiComet');
  var eiNodesG = $('#eiNodes');
  var eiLen = eiPath.getTotalLength();
  var promises = $$('.promise');
  var expectIdx = $('#expectIdx');
  var eiNodes = promises.map(function (p, k) {
    var pt = eiPath.getPointAtLength(eiLen * (k + 0.5) / promises.length);
    var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', pt.x.toFixed(2));
    c.setAttribute('cy', pt.y.toFixed(2));
    c.setAttribute('r', '3.2');
    c.setAttribute('class', 'ei-node');
    eiNodesG.appendChild(c);
    return c;
  });
  eiTrail.style.strokeDasharray = eiLen;
  eiTrail.style.strokeDashoffset = eiLen;
  var eiShown = 0;
  var activePromise = -1;

  /* ------------------------------------------------------------------
     Cursor, tilt, magnetic
     ------------------------------------------------------------------ */
  var cursor = $('.cursor');
  var cursorLabel = $('.cursor-label');
  var mx = -100, my = -100, rx = -100, ry = -100;

  if (finePointer && !reduce) {
    window.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      cursor.style.setProperty('--x', mx + 'px');
      cursor.style.setProperty('--y', my + 'px');
    }, { passive: true });

    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest ? e.target : e.target.parentElement;
      if (!t) return;
      var labelHost = t.closest('[data-cursor]');
      var hover = t.closest('a, button, label, input, select, textarea, [data-tilt]');
      if (labelHost) {
        cursorLabel.textContent = labelHost.getAttribute('data-cursor');
        cursor.classList.add('has-label');
        cursor.classList.remove('is-hover');
      } else {
        cursor.classList.remove('has-label');
        cursor.classList.toggle('is-hover', !!hover);
      }
    });
    document.addEventListener('pointerleave', function () { mx = my = -100; });

    $$('[data-tilt]').forEach(function (el) {
      var soft = el.getAttribute('data-tilt') === 'soft';
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width;
        var y = (e.clientY - r.top) / r.height;
        if (soft) {
          el.style.transform = 'perspective(1400px) rotateX(' + ((0.5 - y) * 5).toFixed(2) + 'deg) rotateY(' + ((x - 0.5) * 6).toFixed(2) + 'deg)';
        } else {
          el.style.setProperty('--rx', ((0.5 - y) * 12).toFixed(2) + 'deg');
          el.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg');
          el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
          el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        }
      });
      el.addEventListener('pointerleave', function () {
        if (soft) { el.style.transform = ''; }
        else { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); }
      });
      if (soft) el.style.transition = 'transform .5s cubic-bezier(.2,.7,.2,1)';
    });

    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transition = 'transform .15s ease-out, filter .3s, background-position .6s, color .3s';
        el.style.transform = 'translate3d(' + (dx * 0.22).toFixed(1) + 'px,' + (dy * 0.32).toFixed(1) + 'px,0)';
      });
      el.addEventListener('pointerleave', function () {
        el.style.transition = 'transform .6s cubic-bezier(.2,.7,.2,1), filter .3s, background-position .6s, color .3s';
        el.style.transform = '';
      });
    });
  }

  /* ------------------------------------------------------------------
     Ambient gold dust (repels from the cursor)
     ------------------------------------------------------------------ */
  var dctx = dustCanvas.getContext('2d');
  var motes = [];
  var sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  (function () {
    var s = sprite.getContext('2d');
    var g = s.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.25, 'rgba(255,214,120,.75)');
    g.addColorStop(1, 'rgba(232,184,74,0)');
    s.fillStyle = g;
    s.fillRect(0, 0, 32, 32);
  })();
  function sizeDust() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    dustCanvas.width = Math.round(vw * dpr);
    dustCanvas.height = Math.round(vh * dpr);
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = reduce ? 0 : vw < 760 ? 22 : 54;
    motes = [];
    for (var i = 0; i < n; i++) {
      motes.push({
        x: Math.random() * vw, y: Math.random() * vh,
        r: 2 + Math.random() * 6,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -(0.08 + Math.random() * 0.32),
        ph: Math.random() * Math.PI * 2,
        ox: 0, oy: 0
      });
    }
  }
  var dustLevel = 0;
  function drawDust(t, level) {
    dctx.clearRect(0, 0, vw, vh);
    if (level < 0.01) return;
    dctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      m.x += m.vx; m.y += m.vy - velocity * 0.02 * (m.r / 8);
      if (m.y < -20) { m.y = vh + 20; m.x = Math.random() * vw; }
      if (m.y > vh + 20) { m.y = -20; }
      if (m.x < -20) m.x = vw + 20; else if (m.x > vw + 20) m.x = -20;
      var dx = m.x + m.ox - mx, dy = m.y + m.oy - my;
      var d2 = dx * dx + dy * dy;
      if (d2 < 22000) {
        var d = Math.sqrt(d2) || 1;
        var f = (148 - d) / 148 * 2.2;
        m.ox += dx / d * f; m.oy += dy / d * f;
      }
      m.ox *= 0.93; m.oy *= 0.93;
      var a = (0.35 + 0.65 * Math.abs(Math.sin(t * 0.0011 + m.ph))) * level;
      dctx.globalAlpha = a;
      dctx.drawImage(sprite, m.x + m.ox - m.r, m.y + m.oy - m.r, m.r * 2, m.r * 2);
    }
    dctx.globalAlpha = 1;
    dctx.globalCompositeOperation = 'source-over';
  }

  /* ------------------------------------------------------------------
     Planning lab
     ------------------------------------------------------------------ */
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function money(v) { return (v < 0 ? '−' : '') + usd.format(Math.abs(Math.round(v))); }
  function val(id) { return parseFloat(document.getElementById(id).value) || 0; }
  function paintRange(input) {
    var min = parseFloat(input.min), max = parseFloat(input.max);
    input.style.setProperty('--fill', ((input.value - min) / (max - min) * 100).toFixed(2) + '%');
  }

  var counters = [];
  function Counter(el, fmt) { this.el = el; this.fmt = fmt; this.v = 0; this.t = 0; this.last = null; counters.push(this); }
  Counter.prototype.set = function (t) { this.t = t; if (reduce) this.v = t; };
  Counter.prototype.step = function () {
    if (Math.abs(this.t - this.v) < 0.5) this.v = this.t; else this.v = lerp(this.v, this.t, 0.14);
    var s = this.fmt(this.v);
    if (s !== this.last) { this.el.textContent = s; this.last = s; }
  };

  var gapCounter = new Counter($('#dimeGap'), money);
  var leftCounter = new Counter($('#leftOver'), money);
  var rateCounter = new Counter($('#saveRate'), function (v) { return Math.round(v) + '%'; });

  function updateDime() {
    var debt = val('d-debt'), income = val('d-income'), years = val('d-years');
    var mortgage = val('d-mortgage'), edu = val('d-education'), have = val('d-existing');
    var incomeNeed = income * years;
    var need = debt + incomeNeed + mortgage + edu;
    var gap = Math.max(0, need - have);
    $('#o-debt').textContent = money(debt);
    $('#o-income').textContent = money(income);
    $('#o-years').textContent = years + (years === 1 ? ' year' : ' years');
    $('#o-mortgage').textContent = money(mortgage);
    $('#o-education').textContent = money(edu);
    $('#o-existing').textContent = money(have);
    $('#dimeNeed').textContent = money(need);
    $('#dimeHave').textContent = money(have);
    $('#k-debt').textContent = money(debt);
    $('#k-income').textContent = money(incomeNeed);
    $('#k-mortgage').textContent = money(mortgage);
    $('#k-education').textContent = money(edu);
    var parts = [debt, incomeNeed, mortgage, edu];
    $$('#dimeStack i').forEach(function (bar, k) {
      bar.style.width = need > 0 ? (parts[k] / need * 100).toFixed(2) + '%' : '0%';
    });
    gapCounter.set(gap);
  }

  function updateBudget() {
    var pay = val('b-takehome'), needs = val('b-needs'), debt = val('b-debtpay'), wants = val('b-wants');
    $('#o-takehome').textContent = money(pay);
    $('#o-needs').textContent = money(needs);
    $('#o-debtpay').textContent = money(debt);
    $('#o-wants').textContent = money(wants);
    var left = pay - needs - debt - wants;
    var rate = pay > 0 ? Math.max(0, left) / pay : 0;
    leftCounter.set(left);
    rateCounter.set(rate * 100);
    $('#ringFill').style.strokeDashoffset = (314.16 * (1 - Math.min(1, rate))).toFixed(2);
    function pct(v) { return pay > 0 ? Math.min(100, v / pay * 100) : 0; }
    [['needs', needs], ['debt', debt], ['wants', wants], ['save', Math.max(0, left)]].forEach(function (row) {
      var p = pct(row[1]);
      $('#bar-' + row[0]).style.width = p.toFixed(1) + '%';
      $('#pct-' + row[0]).textContent = Math.round(p) + '%';
    });
    var msg;
    if (pay <= 0) msg = 'Add your take-home pay to see the picture.';
    else if (left < 0) msg = 'About ' + money(-left) + ' more goes out than comes in each month. Coaching can help you find where it goes.';
    else if (rate < 0.1) msg = 'You keep a little each month. A plan can help that number grow.';
    else if (rate < 0.2) msg = 'Solid footing. Let’s talk about putting that margin to work.';
    else msg = 'Strong margin. Let’s talk about pointing it at your goals.';
    $('#budgetMsg').textContent = msg;
  }

  $$('#dimeForm input[type=range]').forEach(function (inp) {
    paintRange(inp);
    inp.addEventListener('input', function () { paintRange(inp); updateDime(); });
  });
  $$('#budgetForm input[type=range]').forEach(function (inp) {
    paintRange(inp);
    inp.addEventListener('input', function () { paintRange(inp); updateBudget(); });
  });
  updateDime();
  updateBudget();

  // Tabs
  var tabs = $$('.lab-tabs [role=tab]');
  var tabGlow = $('.lab-tab-glow');
  function placeGlow(btn) {
    tabGlow.style.width = btn.offsetWidth + 'px';
    tabGlow.style.height = btn.offsetHeight + 'px';
    tabGlow.style.top = btn.offsetTop + 'px';
    tabGlow.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
  }
  function selectTab(btn, focus) {
    tabs.forEach(function (t) {
      var on = t === btn;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    placeGlow(btn);
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    panel.classList.add('is-in');
    if (focus) btn.focus();
  }
  tabs.forEach(function (t, k) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var next = tabs[(k + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        selectTab(next, true);
      }
    });
  });
  placeGlow(tabs[0]);

  /* ------------------------------------------------------------------
     Office hours (Eastern Time) with live open/closed status
     ------------------------------------------------------------------ */
  var HOURS = { 0: null, 1: [9, 17], 2: [9, 21], 3: [9, 17], 4: [9, 17], 5: [9, 17], 6: [10, 13] };
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function fmtHour(h) { return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? ' AM' : ' PM'); }
  function easternNow() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      var o = {};
      parts.forEach(function (p) { o[p.type] = p.value; });
      var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday);
      return { day: day, mins: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
    } catch (err) {
      var d = new Date();
      return { day: d.getDay(), mins: d.getHours() * 60 + d.getMinutes() };
    }
  }
  function updateHours() {
    var now = easternNow();
    var status = $('#openStatus');
    $$('#hoursBody tr').forEach(function (tr) { tr.classList.toggle('is-today', parseInt(tr.getAttribute('data-days'), 10) === now.day); });
    var today = HOURS[now.day];
    var text;
    var open = false;
    if (today && now.mins >= today[0] * 60 && now.mins < today[1] * 60) {
      open = true;
      text = 'Open now · until ' + fmtHour(today[1]);
    } else if (today && now.mins < today[0] * 60) {
      text = 'Closed · opens today at ' + fmtHour(today[0]);
    } else {
      for (var k = 1; k <= 7; k++) {
        var d = (now.day + k) % 7;
        if (HOURS[d]) { text = 'Closed · opens ' + (k === 1 ? 'tomorrow' : DAY_NAMES[d]) + ' at ' + fmtHour(HOURS[d][0]); break; }
      }
    }
    status.classList.toggle('is-open', open);
    $('span', status).textContent = text + ' (ET)';
  }
  updateHours();
  setInterval(updateHours, 60000);

  /* ------------------------------------------------------------------
     Request form → opens the visitor's email app, pre-filled
     ------------------------------------------------------------------ */
  var form = $('#requestForm');
  var formError = $('#formError');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.elements.name.value.trim();
    var phone = form.elements.phone.value.trim();
    var email = form.elements.email.value.trim();
    var problems = [];
    form.elements.name.setAttribute('aria-invalid', name ? 'false' : 'true');
    if (!name) problems.push('Add your name.');
    var emailBad = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    form.elements.email.setAttribute('aria-invalid', emailBad ? 'true' : 'false');
    if (emailBad) problems.push('Check the email address.');
    if (!phone && !email) {
      problems.push('Add a phone number or email so we can reach you.');
      form.elements.phone.setAttribute('aria-invalid', 'true');
    } else {
      form.elements.phone.setAttribute('aria-invalid', 'false');
    }
    if (problems.length) {
      formError.textContent = problems.join(' ');
      formError.hidden = false;
      return;
    }
    formError.hidden = true;
    var topics = $$('input[name=topic]:checked', form).map(function (c) { return c.value; });
    var body = [
      'Hello Infinite Financial Group,',
      '',
      'I would like to start a conversation.',
      '',
      'Name: ' + name,
      'Phone: ' + (phone || '-'),
      'Email: ' + (email || '-'),
      'Topics: ' + (topics.length ? topics.join(', ') : 'Not specified'),
      'Best time to reach me: ' + form.elements.time.value,
      '',
      'Message:',
      form.elements.message.value.trim() || '-'
    ].join('\n');
    var href = 'mailto:farleyphp@gmail.com?subject=' + encodeURIComponent('Conversation request from ' + name) + '&body=' + encodeURIComponent(body);
    window.location.href = href;
    $('#formNote').innerHTML = 'Your email app should now be open with the request filled in. Press send there to finish. If nothing opened, email <a href="mailto:farleyphp@gmail.com">farleyphp@gmail.com</a> or call <a href="tel:+17064965292">706-496-5292</a>.';
  });

  /* ------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------ */
  var menuBtn = $('#menuToggle');
  var menu = $('#mobileMenu');
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  }
  menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

  $('#year').textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
     Resize
     ------------------------------------------------------------------ */
  var resizeTimer;
  var lastW = vw;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      // Ignore the mobile address bar collapsing (height-only, small change)
      if (window.innerWidth === lastW && Math.abs(window.innerHeight - vh) < 120) { vh = window.innerHeight; return; }
      lastW = window.innerWidth;
      measure();
      placeGlow($('.lab-tabs [aria-selected=true]'));
    }, 140);
  });
  window.addEventListener('load', measure);

  /* ------------------------------------------------------------------
     Main loop
     ------------------------------------------------------------------ */
  function setChapter(ch, o, y) {
    if (Math.abs(ch.o - o) < 0.002 && o !== 0 && o !== 1) return;
    if (ch.o === o) return;
    ch.o = o;
    ch.el.style.opacity = o.toFixed(3);
    ch.el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
    ch.el.classList.toggle('is-active', o > 0.5);
  }

  var labBg = $('.lab-bg');
  var labEl = document.getElementById('lab');
  var missionEl = document.getElementById('mission');
  var missionImg = $('.mission-bg img');
  var promiseList = promises[0].parentElement;
  var svcImgs = svcCards.map(function (c) { return $('.svc-media img', c); });

  function rectOf(el) { var r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height }; }
  function onScreen(r) { return r.top < vh && r.bottom > 0; }

  function tick(t) {
    /* ---- read phase: every layout read happens before any write ---- */
    scrollY = window.scrollY;
    velocity = lerp(velocity, scrollY - lastScrollY, 0.2);
    lastScrollY = scrollY;
    var litR = rectOf(lit);
    var labR = rectOf(labEl);
    var mR = rectOf(missionEl);
    var listR = rectOf(promiseList);
    var promiseR = onScreen(listR) ? promises.map(rectOf) : null;
    var cR = rectOf(contact);
    var inServices = scrollY + vh > L.servicesTop && scrollY < L.servicesTop + L.servicesH;
    var cardR = pinRail && inServices ? svcCards.map(rectOf) : null;
    var railLeft = 0, railMax = 0;
    if (!pinRail) { railLeft = railEl.scrollLeft; railMax = railEl.scrollWidth - railEl.clientWidth; }

    /* ---- write phase ---- */

    // Nav + infinity page meter
    nav.classList.toggle('is-scrolled', scrollY > 40);
    var pageP = clamp(scrollY / Math.max(1, L.docH - vh), 0, 1);
    meter.style.strokeDashoffset = (meterLen * (1 - pageP)).toFixed(2);

    // Preloader infinity
    if (loaderShown < 1) {
      loaderShown = lerp(loaderShown, loaderTarget, 0.12);
      if (loaderTarget >= 1 && loaderShown > 0.995) loaderShown = 1;
      loaderDraw.style.strokeDashoffset = (loaderLen * (1 - loaderShown)).toFixed(2);
      loaderPct.textContent = Math.round(loaderShown * 100);
    }

    // HERO film + chapters
    var heroP = clamp((scrollY - L.heroTop) / Math.max(1, L.heroH - vh), 0, 1);
    if (scrollY < L.heroTop + L.heroH && !reduce) {
      heroFilm.target = heroP;
      heroFilm.current = lerp(heroFilm.current, heroFilm.target, 0.14);
      if (Math.abs(heroFilm.current - heroFilm.target) < 0.0005) heroFilm.current = heroFilm.target;
      var n = heroFilm.render();
      if (n > -1 && n !== heroFilm.shownNo) { heroFilm.shownNo = n; frameNo.textContent = pad3(n + 1); }
      var cp = heroFilm.current;
      var fade = 0.045;
      chapters.forEach(function (ch) {
        var fin = ch.a <= 0 ? 1 : ease(clamp((cp - ch.a) / fade, 0, 1));
        var fout = ch.b >= 1 ? 1 : ease(clamp((ch.b - cp) / fade, 0, 1));
        setChapter(ch, Math.min(fin, fout), (1 - fin) * 34 - (1 - fout) * 34);
      });
      railItems.forEach(function (li, k) { li.classList.toggle('is-on', cp >= chapters[k + 1].a - 0.02); });
      rail.style.setProperty('--p', clamp((cp - 0.2) / 0.62, 0, 1).toFixed(3));
      heroStage.style.setProperty('--cue', (1 - clamp(cp / 0.03, 0, 1)).toFixed(3));
    }

    // Dust: rests while the film is on screen
    var dustTarget = reduce ? 0 : clamp((scrollY - (L.heroTop + L.heroH - vh * 1.2)) / (vh * 0.6), 0, 1) * 0.6;
    dustLevel = lerp(dustLevel, dustTarget, 0.08);
    dustCanvas.style.setProperty('--dust', dustLevel > 0.01 ? 1 : 0);
    drawDust(t, dustLevel);

    // Ticker: speed and lean follow scroll velocity
    if (!reduce && L.tickerHalf > 0) {
      tickerX -= 0.9 + Math.min(Math.abs(velocity) * 0.35, 18);
      if (tickerX <= -L.tickerHalf) tickerX += L.tickerHalf;
      tickerSkew = lerp(tickerSkew, clamp(velocity * -0.35, -12, 12), 0.12);
      ticker.style.transform = 'translate3d(' + tickerX.toFixed(1) + 'px,0,0) skewX(' + tickerSkew.toFixed(2) + 'deg)';
    }

    // Lit statement
    if (onScreen(litR)) {
      var lp = reduce ? 1 : clamp((vh * 0.82 - litR.top) / (vh * 0.5), 0, 1);
      var count = Math.round(lp * litWords.length);
      if (count !== litCount) {
        litCount = count;
        litWords.forEach(function (w, i) { w.classList.toggle('is-lit', i < count); });
      }
    }

    // Services rail
    var rp;
    if (pinRail) {
      rp = clamp((scrollY - L.servicesTop) / Math.max(1, L.servicesH - vh), 0, 1);
      railTrack.style.transform = 'translate3d(' + (-rp * L.railDistance).toFixed(1) + 'px,0,0)';
      if (cardR) {
        cardR.forEach(function (r, k) {
          var off = (r.left + r.width / 2 - vw / 2) / vw;
          svcImgs[k].style.setProperty('--px', (off * -60).toFixed(1) + 'px');
        });
      }
    } else {
      rp = railMax > 0 ? railLeft / railMax : 0;
    }
    var railIdx = Math.min(4, Math.floor(rp * 4.2) + 1);
    if (railIdx !== L.railIdx) { L.railIdx = railIdx; railNow.textContent = railIdx; }
    railBar.style.setProperty('--rp', (rp * 100).toFixed(1) + '%');

    // Lab background drift
    if (onScreen(labR) && !reduce) {
      labBg.style.setProperty('--py', ((labR.top + labR.height / 2 - vh / 2) * -0.12).toFixed(1) + 'px');
    }

    // Mission background
    if (onScreen(mR) && !reduce) {
      var mp = clamp((vh - mR.top) / (vh + mR.height), 0, 1);
      missionImg.style.setProperty('--ms', (1.24 - mp * 0.14).toFixed(4));
      missionImg.style.setProperty('--my', ((mp - 0.5) * -60).toFixed(1) + 'px');
    }

    // Expect: comet follows the promise in focus
    if (promiseR) {
      var center = vh * 0.5;
      var ep = 0;
      var act = 0;
      for (var k = 0; k < promiseR.length; k++) {
        var tt = (center - promiseR[k].top) / promiseR[k].height;
        if (tt >= 0 && tt < 1) { ep = (k + tt) / promiseR.length; act = k; break; }
        if (tt >= 1) { ep = (k + 1) / promiseR.length; act = k; }
      }
      eiShown = reduce ? ep : lerp(eiShown, ep, 0.12);
      var len = eiLen * clamp(eiShown, 0, 0.9999);
      var pt = eiPath.getPointAtLength(len);
      eiComet.setAttribute('cx', pt.x.toFixed(2));
      eiComet.setAttribute('cy', pt.y.toFixed(2));
      eiTrail.style.strokeDashoffset = (eiLen - len).toFixed(2);
      if (act !== activePromise) {
        activePromise = act;
        promises.forEach(function (p, i) { p.classList.toggle('is-on', i === act); });
        eiNodes.forEach(function (c, i) { c.classList.toggle('is-on', i <= act); });
        expectIdx.textContent = promises[act].querySelector('h3').textContent;
      }
    }

    // Contact horizon film
    if (!reduce && cR.top < vh * 2.2 && !contactFilm.started) contactFilm.load();
    if (!reduce && onScreen(cR)) {
      contactFilm.target = clamp((vh - cR.top) / cR.height, 0, 1);
      contactFilm.current = lerp(contactFilm.current, contactFilm.target, 0.12);
      contactFilm.render();
    }

    // Cursor ring easing
    if (finePointer && !reduce) {
      rx = lerp(rx, mx, 0.2);
      ry = lerp(ry, my, 0.2);
      cursor.style.setProperty('--rx', rx.toFixed(1) + 'px');
      cursor.style.setProperty('--ry', ry.toFixed(1) + 'px');
    }

    counters.forEach(function (c) { c.step(); });

    requestAnimationFrame(tick);
  }

  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  requestAnimationFrame(tick);
})();
