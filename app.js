/* TRY/HARD portfolio edition — app.js
   Motion system: intro curtain, masked + staggered reveals, image
   shutters, parallax, magnetic buttons, word cycler, count-up,
   animated menu, hero cursor light, card spotlight and 3D tilt.
   Everything respects prefers-reduced-motion and the manual motion
   toggle (which can also force motion back ON under reduced motion). */
(() => {
  "use strict";

  const doc = document;
  const body = doc.body;
  const root = doc.documentElement;
  root.classList.add("js"); /* CSS gates hidden states on .js — without JS everything stays visible */

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  /* ---------- year ---------- */
  const year = String(new Date().getFullYear());
  doc.querySelectorAll("[data-year]").forEach((el) => { el.textContent = year; });

  /* ---------- motion preferences (manual override) ----------
     motion-off:   "less motion" picked in the footer toggle.
     motion-force: "enable animations" picked while the OS asks for
                   reduced motion. Both choices survive reloads. */
  const motionToggle = doc.querySelector("[data-motion-toggle]");
  const motionLabel = doc.querySelector("[data-motion-label]");
  const OFF_KEY = "th-motion-off";
  const FORCE_KEY = "th-motion-force";
  let motionOff = false;
  let motionForce = false;
  try {
    motionOff = localStorage.getItem(OFF_KEY) === "1";
    motionForce = localStorage.getItem(FORCE_KEY) === "1";
  } catch (e) { /* private mode */ }

  const motionAllowed = () => !motionOff && (!reduceMotion.matches || motionForce);

  const syncMotion = () => {
    root.classList.toggle("motion-off", motionOff);
    root.classList.toggle("motion-force", motionForce);
    const pressed = motionAllowed();
    if (motionToggle) motionToggle.setAttribute("aria-pressed", String(pressed));
    if (motionLabel) motionLabel.textContent = pressed ? "Меньше анимаций" : "Включить анимации";
  };
  syncMotion();
  if (motionToggle) {
    motionToggle.addEventListener("click", () => {
      try {
        if (reduceMotion.matches) {
          if (motionOff) {
            motionOff = false; /* first click drops the manual "off" */
          } else {
            motionForce = !motionForce;
            if (motionForce) motionOff = false;
          }
          localStorage.setItem(FORCE_KEY, motionForce ? "1" : "0");
          localStorage.setItem(OFF_KEY, motionOff ? "1" : "0");
        } else {
          motionOff = !motionOff;
          localStorage.setItem(OFF_KEY, motionOff ? "1" : "0");
        }
      } catch (e) { /* ignore */ }
      syncMotion();
    });
  }
  try { reduceMotion.addEventListener("change", syncMotion); } catch (e) { /* older engines */ }

  /* ---------- intro curtain ---------- */
  const intro = doc.querySelector("[data-intro]");
  const finishIntro = () => {
    if (!intro) { body.classList.add("is-loaded"); return; }
    if (intro.classList.contains("is-gone")) return;
    intro.classList.add("is-done");
    body.classList.add("is-loaded");
    setTimeout(() => intro.classList.add("is-gone"), 950);
  };
  if (!intro || !motionAllowed()) {
    if (intro) intro.classList.add("is-gone");
    body.classList.add("is-loaded");
  } else {
    const started = performance.now();
    const reveal = () => {
      const wait = Math.max(0, 1050 - (performance.now() - started));
      setTimeout(finishIntro, wait);
    };
    if (doc.readyState === "complete") reveal();
    else window.addEventListener("load", reveal, { once: true });
    setTimeout(reveal, 2400); /* safety net if load stalls */
  }

  /* ---------- header state + scroll progress ---------- */
  const header = doc.querySelector("[data-header]");
  const progress = doc.querySelector("[data-progress]");
  const updateScroll = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    if (progress) {
      const max = root.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    }
  };
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", updateScroll, { passive: true });
  updateScroll();

  /* ---------- active nav link (deterministic) ---------- */
  const navLinks = Array.from(doc.querySelectorAll(".site-nav a[href^='#']"));
  const sections = navLinks
    .map((a) => doc.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);
  const updateSpy = () => {
    if (!sections.length) return;
    const bandY = window.innerHeight * 0.425;
    let current = null;
    sections.forEach((s) => {
      const r = s.getBoundingClientRect();
      /* the last section whose top has passed the band stays active,
         so sections without a nav item (process) keep the previous link lit */
      if (r.top <= bandY) current = s.id;
    });
    if (current === null && window.innerHeight + window.scrollY >= root.scrollHeight - 2) {
      current = sections[sections.length - 1].id;
    }
    navLinks.forEach((a) => a.classList.toggle("is-current", current !== null && a.getAttribute("href") === `#${current}`));
  };
  window.addEventListener("scroll", updateSpy, { passive: true });
  updateSpy();

  /* ---------- stagger indices ---------- */
  doc.querySelectorAll("[data-stagger]").forEach((group) => {
    Array.from(group.children).forEach((child, i) => child.style.setProperty("--i", String(i)));
  });

  /* ---------- reveal on scroll ---------- */
  const revealables = doc.querySelectorAll("[data-reveal], [data-stagger]");
  if ("IntersectionObserver" in window && motionAllowed()) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- ambient light spots wake up per dark section ---------- */
  const litSections = doc.querySelectorAll("[data-lit]");
  if (litSections.length && "IntersectionObserver" in window && motionAllowed()) {
    const litIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-lit");
          litIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    litSections.forEach((el) => litIO.observe(el));
  } else {
    litSections.forEach((el) => el.classList.add("is-lit"));
  }

  /* contact trajectory lines draw when visible */
  const contactLines = doc.querySelector(".contact-lines");
  if (contactLines) {
    if ("IntersectionObserver" in window && motionAllowed()) {
      const lineIO = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { contactLines.classList.add("is-in"); lineIO.disconnect(); }
        });
      }, { threshold: 0.15 });
      lineIO.observe(contactLines);
    } else {
      contactLines.classList.add("is-in");
    }
  }

  /* ---------- word cycler ---------- */
  const cycler = doc.querySelector("[data-cycler]");
  if (cycler && motionAllowed()) {
    const words = Array.from(cycler.querySelectorAll(".cycler-word"));
    const indexEl = cycler.querySelector("[data-cycler-index]");
    let wordIndex = 0;
    setInterval(() => {
      words[wordIndex].classList.remove("is-active");
      wordIndex = (wordIndex + 1) % words.length;
      words[wordIndex].classList.add("is-active");
      if (indexEl) indexEl.textContent = String(wordIndex + 1).padStart(2, "0");
    }, 2900);
  }

  /* ---------- count-up stats ---------- */
  const counters = doc.querySelectorAll("[data-count]");
  const runCount = (el) => {
    const target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (!motionAllowed()) { el.textContent = String(target); return; }
    const t0 = performance.now();
    const dur = 1400;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (counters.length && "IntersectionObserver" in window) {
    const cIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { runCount(entry.target); cIO.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => cIO.observe(el));
  } else {
    counters.forEach(runCount);
  }

  /* ---------- parallax (lerp-smoothed, transform only) ---------- */
  const pxElements = Array.from(doc.querySelectorAll("[data-parallax]")).map((el) => ({
    el, factor: parseFloat(el.getAttribute("data-parallax")) || 0.08, y: 0, target: 0,
  }));
  const pxImages = Array.from(doc.querySelectorAll("[data-parallax-img]")).map((el) => ({
    el, factor: parseFloat(el.getAttribute("data-parallax-img")) || 0.06, y: 0, target: 0,
  }));
  if ((pxElements.length || pxImages.length) && motionAllowed()) {
    const measure = (item) => {
      const r = item.el.getBoundingClientRect();
      const center = r.top + r.height / 2 - window.innerHeight / 2;
      const progress = center / window.innerHeight; /* -1..1 across viewport */
      item.target = Math.max(-42, Math.min(42, -progress * item.factor * 100));
    };
    const loop = () => {
      pxElements.concat(pxImages).forEach((item) => {
        measure(item);
        item.y += (item.target - item.y) * 0.12;
        if (Math.abs(item.target - item.y) < 0.05) item.y = item.target;
        item.el.style.transform = `translate3d(0, ${item.y.toFixed(2)}px, 0)`;
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- magnetic buttons ---------- */
  if (finePointer.matches && motionAllowed()) {
    doc.querySelectorAll("[data-magnetic]").forEach((el) => {
      const strength = 0.22;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- hero cursor light (soft glow chasing the pointer) ---------- */
  const hero = doc.querySelector(".hero");
  const heroLight = doc.querySelector(".hero-light");
  if (hero && heroLight && finePointer.matches && motionAllowed()) {
    let lx = 0, ly = 0, tx = 0, ty = 0, raf = 0;
    const step = () => {
      lx += (tx - lx) * 0.09;
      ly += (ty - ly) * 0.09;
      heroLight.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
      if (Math.abs(tx - lx) > 0.4 || Math.abs(ty - ly) > 0.4) raf = requestAnimationFrame(step);
      else raf = 0;
    };
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      heroLight.classList.add("is-on");
      if (!raf) raf = requestAnimationFrame(step);
    });
    hero.addEventListener("pointerleave", () => {
      heroLight.classList.remove("is-on");
      tx = lx; ty = ly; /* stop chasing, fade out via opacity */
    });
  }

  /* ---------- card spotlight + gentle 3D tilt (work cards only) ---------- */
  if (finePointer.matches && motionAllowed()) {
    doc.querySelectorAll(".win").forEach((win) => {
      win.addEventListener("pointermove", (e) => {
        const r = win.getBoundingClientRect();
        win.style.setProperty("--mx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
        win.style.setProperty("--my", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      });
    });
    const MAX_TILT = 2.4;
    doc.querySelectorAll(".work-grid .win").forEach((win) => {
      let rx = 0, ry = 0, trx = 0, tryy = 0, hovering = false, raf = 0;
      const step = () => {
        rx += (trx - rx) * 0.14;
        ry += (tryy - ry) * 0.14;
        const lift = hovering ? -6 : 0;
        win.style.transform = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate3d(0, ${lift}px, 0)`;
        if (hovering || Math.abs(rx) > 0.05 || Math.abs(ry) > 0.05) raf = requestAnimationFrame(step);
        else { win.style.transform = ""; win.classList.remove("is-tilting"); raf = 0; }
      };
      win.addEventListener("pointerenter", () => {
        hovering = true;
        win.classList.add("is-tilting");
        if (!raf) raf = requestAnimationFrame(step);
      });
      win.addEventListener("pointermove", (e) => {
        const r = win.getBoundingClientRect();
        trx = -(((e.clientY - r.top) / r.height) - 0.5) * 2 * MAX_TILT;
        tryy = (((e.clientX - r.left) / r.width) - 0.5) * 2 * MAX_TILT;
      });
      win.addEventListener("pointerleave", () => {
        hovering = false;
        trx = 0; tryy = 0;
        if (!raf) raf = requestAnimationFrame(step);
      });
    });
  }

  /* ---------- process accordion ---------- */
  const steps = Array.from(doc.querySelectorAll(".step"));
  steps.forEach((step) => {
    const head = step.querySelector(".step-head");
    if (!head) return;
    head.addEventListener("click", () => {
      const isOpen = step.classList.contains("is-open");
      steps.forEach((s) => {
        s.classList.remove("is-open");
        const h = s.querySelector(".step-head");
        if (h) h.setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        step.classList.add("is-open");
        head.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* ---------- mobile menu (animated dialog) ---------- */
  const menu = doc.querySelector("[data-menu-dialog]");
  const toggle = doc.querySelector("[data-menu-toggle]");
  const closeBtn = doc.querySelector("[data-menu-close]");
  if (menu && toggle) {
    let closing = null;
    menu.querySelectorAll(".menu-nav a").forEach((a, i) => a.style.setProperty("--i", String(i)));
    const syncClosed = () => {
      if (closing) { clearTimeout(closing); closing = null; }
      menu.classList.remove("is-closing");
      toggle.setAttribute("aria-expanded", "false");
      body.classList.remove("menu-open");
    };
    const openMenu = () => {
      if (menu.open) return;
      menu.classList.remove("is-closing");
      if (typeof menu.showModal === "function") menu.showModal(); else menu.setAttribute("open", "");
      toggle.setAttribute("aria-expanded", "true");
      body.classList.add("menu-open");
    };
    const closeMenu = () => {
      if (!menu.open) return;
      menu.classList.add("is-closing");
      toggle.setAttribute("aria-expanded", "false");
      if (closing) clearTimeout(closing);
      closing = setTimeout(() => {
        closing = null;
        if (menu.open) menu.close();
      }, 420);
    };
    toggle.addEventListener("click", openMenu);
    if (closeBtn) closeBtn.addEventListener("click", closeMenu);
    menu.addEventListener("click", (e) => { if (e.target === menu) closeMenu(); });
    menu.querySelectorAll(".menu-nav a").forEach((link) => link.addEventListener("click", closeMenu));
    /* Esc: play the closing animation instead of an instant cut */
    menu.addEventListener("cancel", (e) => { e.preventDefault(); closeMenu(); });
    menu.addEventListener("close", syncClosed);
    /* Fallback: some engines do not dispatch the dialog "close" event
       (e.g. Electron/Chromium 152). The "open" attribute is always
       removed on close, so watch it as a safety net. */
    if ("MutationObserver" in window) {
      new MutationObserver(() => { if (!menu.open) syncClosed(); })
        .observe(menu, { attributes: true, attributeFilter: ["open"] });
    }
  }

  /* ---------- local links on localhost ----------
     Published links point to GitHub Pages. When the site is served
     locally (e.g. serve.ps1 at :8901), verify sibling project folders
     exist and rewrite the project links to relative paths.
     Keys are local folder names; they may differ from the published
     slugs (e.g. sistema-krasoty locally, sistema-krasoti on Pages).
     Skorochisto has no local folder, so its links always keep the
     published URL and are not probed (avoids a 404 in the console). */
  const localSlugs = { sdvig: "sdvig/", beauty: "sistema-krasoty/", chisto: "chisto/" };
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  if (isLocal && window.location.protocol.startsWith("http")) {
    Object.keys(localSlugs).forEach((key) => {
      const probe = new URL("../" + localSlugs[key], window.location.href);
      fetch(probe.href, { method: "HEAD" }).then((res) => {
        if (!res.ok) return;
        doc.querySelectorAll(`[data-proj="${key}"]`).forEach((a) => { a.href = "../" + localSlugs[key]; });
      }).catch(() => {});
    });
  }
})();
