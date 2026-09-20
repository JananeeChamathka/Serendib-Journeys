(function () {
  "use strict";

  var qs = function (s, c) { return (c || document).querySelector(s); };
  var qsa = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var canFx = hasGsap && !REDUCED;

  var lenis = null;

  if (!canFx) {
    document.documentElement.classList.remove("js");
    document.documentElement.classList.remove("lock");
  } else {
    gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ ease: "power3.out" });
  }

  function splitChars(el) {
    var text = el.textContent;
    el.setAttribute("aria-label", text);
    el.textContent = "";
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === " ") {
        frag.appendChild(document.createTextNode(" "));
        continue;
      }
      var span = document.createElement("span");
      span.className = "char";
      span.setAttribute("aria-hidden", "true");
      span.textContent = ch;
      frag.appendChild(span);
    }
    el.appendChild(frag);
    return qsa(".char", el);
  }

  function splitWords(el) {
    var words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", words.join(" "));
    el.textContent = "";
    words.forEach(function (w, i) {
      var s = document.createElement("span");
      s.className = "w";
      s.setAttribute("aria-hidden", "true");
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
    return qsa(".w", el);
  }

  function showToast(msg) {
    var toast = qs(".toast");
    if (!toast) return;
    qs(".toast-msg", toast).textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.remove("show"); }, 3400);
  }

  function setupLenis() {
    if (!canFx || typeof window.Lenis === "undefined") return null;
    var l = new Lenis({
      duration: 1.15,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6
    });
    l.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { l.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    return l;
  }

  function initNav() {
    var nav = qs(".nav");
    var progress = qs(".progress span");
    var lastY = 0;

    function onScrollData(y, limit) {
      nav.classList.toggle("scrolled", y > 50);
      if (y > 160 && y - lastY > 2 && !document.body.classList.contains("menu-open")) {
        nav.classList.add("nav--hidden");
      } else if (y - lastY < -2 || y < 160) {
        nav.classList.remove("nav--hidden");
      }
      lastY = y;
      var frac = limit > 0 ? Math.min(1, y / limit) : 0;
      if (progress) progress.style.transform = "scaleX(" + frac + ")";
    }

    if (lenis) {
      lenis.on("scroll", function (e) { onScrollData(e.scroll, e.limit); });
    }
    window.addEventListener("scroll", function () {
      if (lenis) return;
      var y = window.scrollY || document.documentElement.scrollTop;
      var limit = document.documentElement.scrollHeight - window.innerHeight;
      onScrollData(y, limit);
    }, { passive: true });
  }

  function initCursor() {
    if (!FINE || !canFx) return;
    document.body.classList.add("has-cursor");
    var dot = qs(".cursor-dot");
    var ring = qs(".cursor-ring");
    var label = qs(".cursor-label", ring);

    var mx = innerWidth / 2, my = innerHeight / 2;
    var dx = mx, dy = my, rx = mx, ry = my;

    var dotX = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power3" });
    var dotY = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power3" });
    var ringX = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" });
    var ringY = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" });

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dotX(mx); dotY(my); ringX(mx); ringY(my);
    }, { passive: true });

    gsap.ticker.add(function () {
      dx += (mx - dx) * 0.55; dy += (my - dy) * 0.55;
    });

    document.addEventListener("mouseover", function (e) {
      var view = e.target.closest("[data-cursor='view']");
      var hov = e.target.closest("a, button, [data-magnetic]");
      if (view) {
        ring.classList.add("is-view");
        ring.classList.remove("is-hover");
        label.textContent = view.getAttribute("data-cursor-label") || "Explore";
      } else if (hov) {
        ring.classList.add("is-hover");
        ring.classList.remove("is-view");
      } else {
        ring.classList.remove("is-hover", "is-view");
      }
    });
  }

  function initMagnetic() {
    if (!FINE || !canFx) return;
    qsa("[data-magnetic]").forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-magnetic")) || 0.35;
      var xTo = gsap.quickTo(el, "x", { duration: 0.9, ease: "elastic.out(1, 0.35)" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.9, ease: "elastic.out(1, 0.35)" });
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener("mouseleave", function () { xTo(0); yTo(0); });
    });
  }

  function initMenu() {
    var burger = qs(".burger");
    var overlay = qs(".menu-overlay");
    var previews = qsa(".menu-preview img");
    var links = qsa(".menu-list a");

    function setOpen(open) {
      document.body.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (lenis) { open ? lenis.stop() : lenis.start(); }
      document.documentElement.classList.toggle("lock", open && !lenis);
    }

    burger.addEventListener("click", function () {
      setOpen(!document.body.classList.contains("menu-open"));
    });

    links.forEach(function (link) {
      link.addEventListener("mouseenter", function () {
        var i = parseInt(link.getAttribute("data-preview"), 10);
        previews.forEach(function (img) {
          img.classList.toggle("active", parseInt(img.getAttribute("data-i"), 10) === i);
        });
      });
    });

    overlay.addEventListener("mouseleave", function () {
      previews.forEach(function (img) { img.classList.remove("active"); });
    });

    return setOpen;
  }

  function pageGoTo(hash, closeMenu) {
    var el = qs(hash);
    if (!el) return;
    if (closeMenu) closeMenu();
    if (!lenis || REDUCED) {
      setTimeout(function () { el.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }); }, closeMenu ? 350 : 0);
      return;
    }
    var panel = qs(".transition");
    gsap.timeline()
      .set(panel, { transformOrigin: "bottom" })
      .to(panel, { scaleY: 1, duration: 0.5, ease: "power4.in" })
      .add(function () { lenis.scrollTo(el, { immediate: true }); ScrollTrigger.refresh(); })
      .set(panel, { transformOrigin: "top" })
      .to(panel, { scaleY: 0, duration: 0.7, ease: "power4.out" }, "+=0.08");
  }

  function initAnchors(closeMenu) {
    qsa("a[href^='#']").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var hash = a.getAttribute("href");
        if (hash.length < 2) { e.preventDefault(); return; }
        e.preventDefault();
        pageGoTo(hash, a.closest(".menu-overlay") ? closeMenu : null);
      });
    });
  }

  function initHero() {
    var title = qs(".hero-title");
    var chars = splitChars(title);
    gsap.set(chars, { yPercent: 120, rotate: 6, transformOrigin: "left bottom", display: "inline-block" });
    return chars;
  }

  function playIntro(chars, done) {
    document.documentElement.classList.add("lock");
    if (lenis) lenis.stop();

    var counter = qs(".pre-count");
    var obj = { v: 0 };
    var brandChars = splitChars(qs(".pre-logo"));

    gsap.set(brandChars, { yPercent: 130, display: "inline-block" });
    gsap.set([".hero-eyebrow", ".hero-sub"], { opacity: 0, y: 30 });
    gsap.set(".hero-actions > *", { opacity: 0, y: 24 });
    gsap.set([".hero-side", ".hero-coords"], { opacity: 0 });
    gsap.set(".nav", { opacity: 0, y: -20 });
    gsap.set(".marquee", { opacity: 0 });

    gsap.timeline({
      onComplete: function () {
        qs(".preloader").style.display = "none";
        document.documentElement.classList.remove("lock");
        if (lenis) lenis.start();
        if (done) done();
      }
    })
      .to(brandChars, { yPercent: 0, duration: 0.9, stagger: 0.05, ease: "power4.out" }, 0.15)
      .to(obj, {
        v: 100, duration: 1.7, ease: "power2.inOut",
        onUpdate: function () { counter.textContent = String(Math.round(obj.v)).padStart(3, "0"); }
      }, 0.15)
      .to(".pre-line span", { scaleX: 1, duration: 1.7, ease: "power2.inOut" }, 0.15)
      .to([".pre-logo span", ".pre-count"], { y: -34, opacity: 0, duration: 0.45, ease: "power2.in", stagger: 0.02 }, "+=0.15")
      .to(".preloader", { yPercent: -100, duration: 1, ease: "power4.inOut" }, "-=0.1")
      .add(heroReveal(chars), "-=0.55");
  }

  function heroReveal(chars) {
    var tl = gsap.timeline();
    tl.to(".hero-bg img", { scale: 1.06, duration: 2.4, ease: "power2.out" }, 0)
      .to(chars, { yPercent: 0, rotate: 0, duration: 1.15, stagger: 0.045, ease: "power4.out" }, 0.1)
      .to(".letterbox", { height: 0, duration: 1.1, ease: "power4.inOut", stagger: 0.08 }, 0.35)
      .to(".hero-eyebrow", { opacity: 1, y: 0, duration: 0.8 }, 0.7)
      .to(".hero-sub", { opacity: 1, y: 0, duration: 0.8 }, 0.85)
      .to(".hero-actions > *", { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }, 1)
      .to([".hero-side", ".hero-coords"], { opacity: 1, duration: 1 }, 1.25)
      .to(".nav", { opacity: 1, y: 0, duration: 0.8 }, 1.15)
      .to(".marquee", { opacity: 1, duration: 1 }, 1.35)
      .add(function () { ScrollTrigger.refresh(); });
    return tl;
  }

  function initParallax() {
    gsap.to(".hero-bg img", {
      yPercent: 16, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
    gsap.to(".hero-content", {
      yPercent: -14, opacity: 0.15, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 30%", scrub: true }
    });
    qsa("[data-parallax]").forEach(function (fig) {
      var amt = parseFloat(fig.getAttribute("data-parallax")) || 10;
      gsap.fromTo(qs("img", fig), { yPercent: -amt }, {
        yPercent: amt, ease: "none",
        scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  }

  function initWordReveal() {
    var p = qs(".word-reveal");
    if (!p) return;
    var words = splitWords(p);
    gsap.fromTo(words, { opacity: 0.13 }, {
      opacity: 1, stagger: 0.03, ease: "none",
      scrollTrigger: { trigger: p, start: "top 78%", end: "bottom 46%", scrub: 0.6 }
    });
  }

  function initReveals() {
    qsa("[data-reveal]").forEach(function (el) {
      gsap.fromTo(el, { y: 52, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1.1,
        delay: parseFloat(el.getAttribute("data-reveal-delay")) || 0,
        scrollTrigger: { trigger: el, start: "top 87%", once: true }
      });
    });
    qsa("[data-reveal-group]").forEach(function (group) {
      gsap.fromTo(Array.prototype.slice.call(group.children), { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.9, stagger: 0.09,
        scrollTrigger: { trigger: group, start: "top 86%", once: true }
      });
    });
  }

  function initDestinations() {
    qsa(".dest-row").forEach(function (row, idx) {
      var media = qs(".dest-media", row);
      var zoom = qs(".dest-zoom", row);
      var img = qs("img", zoom);
      var num = qs(".dest-num", row);

      gsap.fromTo(media, {
        clipPath: "inset(16% 9% 16% 9% round 8px)"
      }, {
        clipPath: "inset(0% 0% 0% 0% round 8px)",
        duration: 1.35, ease: "power4.out",
        scrollTrigger: { trigger: row, start: "top 80%", once: true }
      });
      gsap.fromTo(img, { scale: 1.32 }, {
        scale: 1.14, duration: 1.7, ease: "power3.out",
        scrollTrigger: { trigger: row, start: "top 80%", once: true }
      });
      gsap.to(img, {
        yPercent: 8, ease: "none",
        scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: true }
      });
      gsap.fromTo(num, {
        x: idx % 2 ? 60 : -60, opacity: 0
      }, {
        x: 0, opacity: 1, duration: 1.1,
        scrollTrigger: { trigger: row, start: "top 75%", once: true }
      });
      gsap.fromTo(qs(".dest-info", row).children, { y: 38, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.95, stagger: 0.07,
        scrollTrigger: { trigger: row, start: "top 74%", once: true }
      });
    });
  }

  function initExperiences() {
    var mm = gsap.matchMedia();

    mm.add("(min-width: 901px)", function () {
      var track = qs(".exp-track");
      var section = qs(".experiences");
      var amount = function () { return track.scrollWidth - window.innerWidth + parseFloat(getComputedStyle(track).paddingRight || 0); };

      var scrollTween = gsap.to(track, {
        x: function () { return -amount(); },
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: function () { return "+=" + amount(); },
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: function (self) {
            var bar = qs(".exp-bar");
            if (bar) bar.style.transform = "scaleX(" + self.progress + ")";
          }
        }
      });

      qsa(".exp-card").forEach(function (card) {
        gsap.fromTo(card, { opacity: 0.35 }, {
          opacity: 1, ease: "none",
          scrollTrigger: {
            trigger: card,
            containerAnimation: scrollTween,
            start: "left 100%",
            end: "left 65%",
            scrub: true
          }
        });
      });
    });

    mm.add("(max-width: 900px)", function () {
      qsa(".exp-card").forEach(function (card) {
        gsap.fromTo(card, { y: 56, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1,
          scrollTrigger: { trigger: card, start: "top 88%", once: true }
        });
      });
      var bar = qs(".exp-bar");
      if (bar) {
        gsap.fromTo(bar, { scaleX: 0 }, {
          scaleX: 1, ease: "none",
          scrollTrigger: { trigger: ".exp-track", start: "top 80%", end: "bottom 40%", scrub: 0.6 }
        });
      }
    });
  }

  function initCounters() {
    qsa("[data-count]").forEach(function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var suffix = el.getAttribute("data-suffix") || "";
      if (!canFx) { el.textContent = target + suffix; return; }
      var obj = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: "top 88%", once: true,
        onEnter: function () {
          gsap.to(obj, {
            v: target, duration: 1.8, ease: "power3.out",
            onUpdate: function () { el.textContent = Math.round(obj.v) + suffix; }
          });
        }
      });
    });
  }

  function initTilt() {
    if (!FINE || !canFx) return;
    qsa("[data-tilt]").forEach(function (card) {
      var rotX = gsap.quickTo(card, "rotationX", { duration: 0.7, ease: "power3" });
      var rotY = gsap.quickTo(card, "rotationY", { duration: 0.7, ease: "power3" });
      gsap.set(card, { transformPerspective: 900 });
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        rotX(py * -7);
        rotY(px * 9);
        card.style.setProperty("--gx", (px + 0.5) * 100 + "%");
        card.style.setProperty("--gy", (py + 0.5) * 100 + "%");
      });
      card.addEventListener("mouseleave", function () { rotX(0); rotY(0); });
    });
  }

  function initSpotlight() {
    var section = qs(".cta");
    var glow = qs(".cta-glow");
    if (!section || !glow || !FINE || !canFx) return;
    var xTo = gsap.quickTo(glow, "x", { duration: 1, ease: "power3" });
    var yTo = gsap.quickTo(glow, "y", { duration: 1, ease: "power3" });
    section.addEventListener("mousemove", function (e) {
      var r = section.getBoundingClientRect();
      xTo(e.clientX - r.left);
      yTo(e.clientY - r.top);
    });
  }

  function initTestimonials() {
    var data = [
      { q: "It didn’t feel like a holiday. It felt like the best film we never wanted to end.", c: "Charlotte & Amir — London · 14-day Grand Circuit" },
      { q: "They moved mountains silently — a private carriage, a closed beach at dawn. Flawless.", c: "Yukiko Tanaka — Tokyo · Honeymoon Suite Journey" },
      { q: "Our guide Nimal knew the leopards by name. By day three, so did we.", c: "The Bergström Family — Stockholm · Wild Sri Lanka" }
    ];
    var box = qs(".tsl-quote");
    var qt = qs("#tsl-text");
    var cite = qs("#tsl-cite");
    var dotsWrap = qs("#tsl-dots");
    var idx = 0;
    var timer = null;

    data.forEach(function (_, i) {
      var d = document.createElement("button");
      d.className = "tsl-dot" + (i === 0 ? " on" : "");
      d.setAttribute("aria-label", "Story " + (i + 1));
      d.addEventListener("click", function () { go(i, true); });
      dotsWrap.appendChild(d);
    });
    var dots = qsa(".tsl-dot", dotsWrap);

    function render(i) {
      qt.textContent = data[i].q;
      cite.textContent = data[i].c;
      dots.forEach(function (d, j) { d.classList.toggle("on", j === i); });
    }

    function go(i, user) {
      idx = (i + data.length) % data.length;
      box.classList.add("out");
      setTimeout(function () { render(idx); box.classList.remove("out"); }, 380);
      if (user) restart();
    }

    function restart() {
      clearInterval(timer);
      timer = setInterval(function () { go(idx + 1); }, 6500);
    }

    qs("#tsl-prev").addEventListener("click", function () { go(idx - 1, true); });
    qs("#tsl-next").addEventListener("click", function () { go(idx + 1, true); });
    var wrap = qs(".testimonials");
    wrap.addEventListener("mouseenter", function () { clearInterval(timer); });
    wrap.addEventListener("mouseleave", restart);
    if (!REDUCED) restart();
  }

  function initForm() {
    var form = qs("#inquiry");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = qs("#f-name");
      var email = qs("#f-email");
      var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
      if (!name.value.trim()) { name.focus(); showToast("Please tell us your name."); return; }
      if (!okEmail) { email.focus(); showToast("That email doesn’t look quite right."); return; }
      var btn = qs("button[type='submit'] .btn-label", form);
      var original = btn.textContent;
      btn.textContent = "Sending…";
      setTimeout(function () {
        btn.textContent = original;
        form.reset();
        showToast("Thank you — our travel director will reply within 24 hours.");
      }, 900);
    });
  }

  function initImageFallback() {
    qsa("img").forEach(function (img) {
      img.addEventListener("error", function () {
        var box = img.closest("[data-imgbox]") || img.parentElement;
        if (box) box.classList.add("img-fallback");
        img.remove();
      });
    });
  }

  function initClock() {
    var clockEl = qs("#clock");
    var yearEl = qs("#year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    if (!clockEl) return;
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
    } catch (err) {
      fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    function tick() { clockEl.textContent = fmt.format(new Date()); }
    tick();
    setInterval(tick, 1000);
  }

  function boot() {
    initImageFallback();
    initClock();
    initForm();

    if (!canFx) {
      initTestimonials();
      initAnchors(null);
      return;
    }

    lenis = setupLenis();
    var closeMenu = initMenu();
    initNav();
    initCursor();
    initMagnetic();
    initAnchors(closeMenu);

    var chars = initHero();
    playIntro(chars);

    initParallax();
    initWordReveal();
    initReveals();
    initDestinations();
    initExperiences();
    initCounters();
    initTilt();
    initSpotlight();
    initTestimonials();

    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }

    var playBtn = qs(".play-btn");
    if (playBtn) {
      playBtn.addEventListener("click", function () {
        showToast("The film premieres with your first itinerary.");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
