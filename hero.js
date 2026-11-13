(() => {
  "use strict";

  // A self-contained first-screen scene. No libraries, scroll hijacking, or global cursor.
  const create = ({ reduced = false } = {}) => {
    const hero = document.querySelector("[data-hero]");
    if (!hero) return null;

    const canvas = hero.querySelector("[data-hero-canvas]");
    const context = canvas?.getContext("2d");
    const word = hero.querySelector("[data-hero-word]");
    const wordIndex = hero.querySelector("[data-hero-word-index]");
    const portrait = hero.querySelector(".portrait--hero");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const words = ["Дизайн со смыслом", "Визуал с характером", "Код без случайностей"];
    const animations = new Set();
    const variables = new Map();
    const pointer = { x: .5, y: .5, targetX: .5, targetY: .5, inside: false };
    const magnets = [...hero.querySelectorAll("[data-hero-magnetic]")].map((element) => ({
      element, rect: null, x: 0, y: 0, targetX: 0, targetY: 0, lastX: "", lastY: "",
    }));
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    let bounds;
    let inView = true;
    let running = false;
    let introPlayed = false;
    let frame = 0;
    let wordTimer = 0;
    let wordDue = 0;
    let wordDelay = 3800;
    let cycling = false;
    let wordEpoch = 0;
    let currentWord = 0;
    let lastDraw = -Infinity;
    let lastFrame = 0;
    let sceneTime = 0;
    let scrollDirty = true;
    let scrollProgress = 0;
    let targetScrollProgress = 0;
    let lastMode = "";

    const setVariable = (name, value) => {
      if (variables.get(name) === value) return;
      variables.set(name, value);
      hero.style.setProperty(name, value);
    };

    const setMagnet = (magnet) => {
      const x = `${magnet.x.toFixed(2)}px`;
      const y = `${magnet.y.toFixed(2)}px`;
      if (x !== magnet.lastX) {
        magnet.element.style.setProperty("--hero-button-x", x);
        magnet.lastX = x;
      }
      if (y !== magnet.lastY) {
        magnet.element.style.setProperty("--hero-button-y", y);
        magnet.lastY = y;
      }
    };

    const animate = (element, keyframes, options) => {
      if (!element?.animate || reduced || !running) return null;
      const animation = element.animate(keyframes, { fill: "both", ...options });
      animations.add(animation);
      // Cancellation is normal when motion is disabled or this screen leaves view.
      animation.finished.then(() => {
        animations.delete(animation);
        animation.cancel();
      }, () => animations.delete(animation));
      return animation;
    };

    const renderWord = () => {
      if (!word) return [];
      const letters = [...words[currentWord]].map((character) => {
        const letter = document.createElement("span");
        letter.className = "hero-letter";
        letter.textContent = character === " " ? "\u00a0" : character;
        return letter;
      });
      word.replaceChildren(...letters);
      if (wordIndex) wordIndex.textContent = String(currentWord + 1).padStart(2, "0");
      hero.dataset.heroActiveWord = String(currentWord);
      return letters;
    };

    const scheduleWord = (delay = wordDelay) => {
      if (!running || !word || wordTimer) return;
      wordDelay = delay;
      wordDue = performance.now() + delay;
      wordTimer = window.setTimeout(() => {
        wordTimer = 0;
        wordDue = 0;
        cycleWord();
      }, delay);
    };

    const cycleWord = async () => {
      if (!running || !word || cycling) return;
      const epoch = wordEpoch;
      cycling = true;
      try {
        const outgoing = [...word.children].map((letter, index) => animate(letter, [
          { opacity: 1, transform: "translateY(0) rotateX(0deg)" },
          { opacity: 0, transform: "translateY(-80%) rotateX(-75deg)" },
        ], { duration: 230, delay: index * 8, easing: "cubic-bezier(.55,0,.7,.4)" }));
        await Promise.allSettled(outgoing.filter(Boolean).map((animation) => animation.finished));
        if (!running || epoch !== wordEpoch) return;

        currentWord = (currentWord + 1) % words.length;
        const incoming = renderWord().map((letter, index) => animate(letter, [
          { opacity: 0, transform: "translateY(90%) rotateX(75deg)" },
          { opacity: 1, transform: "translateY(0) rotateX(0deg)" },
        ], { duration: 510, delay: index * 14, easing: "cubic-bezier(.16,1,.3,1)" }));
        await Promise.allSettled(incoming.filter(Boolean).map((animation) => animation.finished));
        if (running && epoch === wordEpoch) scheduleWord(3400);
      } finally {
        if (epoch === wordEpoch) cycling = false;
      }
    };

    const playIntro = () => {
      introPlayed = true;
      hero.dataset.heroIntro = "playing";
      const intro = [];
      hero.querySelectorAll("[data-hero-title-line]").forEach((line, index) => {
        intro.push(animate(line, [
          { transform: "translateY(113%) rotate(2deg)", opacity: .3 },
          { transform: "translateY(0) rotate(0deg)", opacity: 1 },
        ], { duration: 1250, delay: 150 + index * 130, easing: "cubic-bezier(.16,1,.3,1)" }));
      });
      hero.querySelectorAll("[data-hero-enter]").forEach((element, index) => {
        intro.push(animate(element, [
          { opacity: 0, transform: "translateY(18px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 850, delay: index < 2 ? index * 100 : 320 + index * 100, easing: "cubic-bezier(.22,1,.36,1)" }));
      });
      intro.push(animate(portrait, [
        { opacity: 0, transform: "translateY(35px) rotateY(-8deg)" },
        { opacity: 1, transform: "translateY(0) rotateY(0deg)" },
      ], { duration: 1500, delay: 180, easing: "cubic-bezier(.16,1,.3,1)" }));
      Promise.allSettled(intro.filter(Boolean).map((animation) => animation.finished)).then(() => {
        hero.dataset.heroIntro = "complete";
      });
    };

    const drawBlueprint = (time = 0) => {
      if (!context || !bounds) return;
      const { width, height } = bounds;
      context.clearRect(0, 0, width, height);
      const horizon = height * .44;
      const vanishingX = width * .67 + (pointer.x - .5) * 26;
      const scanY = height * (.38 + Math.sin(time * .00018) * .21);

      // Restrained architectural grid: a quiet plane, not a particle fireworks effect.
      context.lineWidth = .6;
      for (let y = 110; y < height; y += 84) {
        const proximity = Math.max(0, 1 - Math.abs(y - scanY) / 160);
        context.strokeStyle = `rgba(187,198,223,${.032 + proximity * .07})`;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      context.strokeStyle = "rgba(188,199,223,.035)";
      for (let x = -width * .2; x <= width * 1.2; x += 105) {
        context.beginPath();
        context.moveTo(vanishingX + (x - vanishingX) * .57, horizon);
        context.lineTo(x, height);
        context.stroke();
      }

      for (let y = 110; y < height; y += 168) {
        for (let x = 38; x < width; x += 168) {
          const proximity = Math.max(0, 1 - Math.abs(y - scanY) / 180);
          context.strokeStyle = `rgba(202,212,232,${.075 + proximity * .12})`;
          context.beginPath();
          context.moveTo(x - 3, y);
          context.lineTo(x + 3, y);
          context.moveTo(x, y - 3);
          context.lineTo(x, y + 3);
          context.stroke();
        }
      }

      if (pointer.inside && finePointer.matches && window.innerWidth > 680) {
        const x = pointer.x * width;
        const y = pointer.y * height;
        const glow = context.createRadialGradient(x, y, 0, x, y, 140);
        glow.addColorStop(0, "rgba(184,199,231,.065)");
        glow.addColorStop(1, "rgba(184,199,231,0)");
        context.fillStyle = glow;
        context.fillRect(x - 140, y - 140, 280, 280);
        context.strokeStyle = "rgba(205,218,242,.25)";
        context.beginPath();
        context.moveTo(x - 7, y);
        context.lineTo(x + 7, y);
        context.moveTo(x, y - 7);
        context.lineTo(x, y + 7);
        context.stroke();
      }
    };

    const measure = () => {
      const rect = hero.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      bounds = { width: rect.width, height: rect.height, left: rect.left, top: rect.top + window.scrollY };
      inView = rect.bottom > 0 && rect.top < window.innerHeight;
      if (canvas && context) {
        canvas.width = Math.round(bounds.width * ratio);
        canvas.height = Math.round(bounds.height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
      scrollDirty = true;
      magnets.forEach((magnet) => { magnet.rect = magnet.element.getBoundingClientRect(); });
      if (!running) drawBlueprint(reduced ? 0 : sceneTime);
    };

    const resetScene = () => {
      pointer.inside = false;
      pointer.x = pointer.targetX = pointer.y = pointer.targetY = .5;
      setVariable("--hero-pointer-x", "0");
      setVariable("--hero-pointer-y", "0");
      setVariable("--hero-tilt-x", "0deg");
      setVariable("--hero-tilt-y", "0deg");
      setVariable("--hero-frame-y", "0px");
      setVariable("--hero-light-x", "0px");
      setVariable("--hero-light-y", "0px");
      magnets.forEach((magnet) => {
        magnet.x = magnet.y = magnet.targetX = magnet.targetY = 0;
        setMagnet(magnet);
      });
      scrollProgress = targetScrollProgress = 0;
      scrollDirty = true;
    };

    const tick = (now) => {
      if (!running) { frame = 0; return; }
      const delta = lastFrame ? Math.min(now - lastFrame, 64) : 16;
      const smoothing = 1 - Math.exp(-delta / 100);
      lastFrame = now;
      sceneTime += delta;
      pointer.x += (pointer.targetX - pointer.x) * smoothing;
      pointer.y += (pointer.targetY - pointer.y) * smoothing;
      if (scrollDirty) {
        targetScrollProgress = clamp((window.scrollY - bounds.top) / bounds.height, 0, 1);
        scrollDirty = false;
      }
      scrollProgress += (targetScrollProgress - scrollProgress) * smoothing;
      const x = (pointer.x - .5) * 2;
      const y = (pointer.y - .5) * 2;
      const interactive = finePointer.matches && window.innerWidth > 680;
      setVariable("--hero-pointer-x", x.toFixed(3));
      setVariable("--hero-pointer-y", y.toFixed(3));
      setVariable("--hero-tilt-x", `${interactive ? (-y * 2.3).toFixed(3) : 0}deg`);
      setVariable("--hero-tilt-y", `${interactive ? (x * 3.4).toFixed(3) : 0}deg`);
      setVariable("--hero-frame-y", `${interactive ? (scrollProgress * -38).toFixed(2) : 0}px`);
      setVariable("--hero-light-x", `${(x * 90).toFixed(2)}px`);
      setVariable("--hero-light-y", `${(y * 60 + scrollProgress * 100).toFixed(2)}px`);
      magnets.forEach((magnet) => {
        magnet.x += (magnet.targetX - magnet.x) * smoothing;
        magnet.y += (magnet.targetY - magnet.y) * smoothing;
        setMagnet(magnet);
      });
      // Canvas is capped at 30 fps / 1.5 DPR; pointer and transform easing stay native-rate.
      if (now - lastDraw >= 32) { drawBlueprint(sceneTime); lastDraw = now; }
      frame = window.requestAnimationFrame(tick);
    };

    const refreshMotion = () => {
      const mode = reduced ? "reduced" : document.hidden ? "hidden" : document.body.classList.contains("overlay-open") ? "overlay" : !inView ? "offscreen" : "running";
      const nextRunning = mode === "running";
      hero.dataset.heroMotion = mode;
      hero.classList.toggle("hero-motion-enabled", !reduced);
      hero.classList.toggle("hero-motion-running", nextRunning);
      hero.classList.toggle("hero--paused", reduced);
      if (mode === lastMode) return;
      lastMode = mode;
      running = nextRunning;

      if (!running) {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        if (wordTimer) wordDelay = Math.max(0, wordDue - performance.now());
        window.clearTimeout(wordTimer);
        wordTimer = 0;
        wordDue = 0;
        if (reduced) {
          wordEpoch++;
          cycling = false;
          wordDelay = 3800;
          animations.forEach((animation) => animation.cancel());
          animations.clear();
          introPlayed = true;
          hero.dataset.heroIntro = "complete";
          resetScene();
          drawBlueprint();
        } else {
          // Keep animation playheads and the canvas intact: pause means freeze, not reset.
          animations.forEach((animation) => animation.pause());
        }
        return;
      }

      lastFrame = 0;
      lastDraw = -Infinity;
      scrollDirty = true;
      animations.forEach((animation) => animation.play());
      if (!introPlayed) playIntro();
      if (!cycling) scheduleWord();
      frame = window.requestAnimationFrame(tick);
    };

    // The existing reveal system still controls every other section, unchanged.
    hero.querySelectorAll("[data-reveal]").forEach((node) => node.classList.add("is-visible"));
    renderWord();
    measure();
    refreshMotion();

    hero.addEventListener("pointermove", (event) => {
      if (!running || !finePointer.matches || window.innerWidth <= 680 || event.pointerType === "touch") return;
      pointer.targetX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
      pointer.targetY = clamp((event.clientY + window.scrollY - bounds.top) / bounds.height, 0, 1);
      pointer.inside = true;
    }, { passive: true });
    hero.addEventListener("pointerleave", () => {
      pointer.inside = false;
      pointer.targetX = pointer.targetY = .5;
    });

    magnets.forEach((magnet) => {
      magnet.element.addEventListener("pointerenter", () => { magnet.rect = magnet.element.getBoundingClientRect(); });
      magnet.element.addEventListener("pointermove", (event) => {
        if (!running || !finePointer.matches || window.innerWidth <= 680 || event.pointerType === "touch" || !magnet.rect) return;
        magnet.targetX = clamp(((event.clientX - magnet.rect.left) / magnet.rect.width - .5) * 14, -6, 6);
        magnet.targetY = clamp(((event.clientY - magnet.rect.top) / magnet.rect.height - .5) * 9, -4, 4);
      }, { passive: true });
      magnet.element.addEventListener("pointerleave", () => { magnet.targetX = magnet.targetY = 0; });
    });

    window.addEventListener("scroll", () => { scrollDirty = true; }, { passive: true });
    window.addEventListener("resize", () => { measure(); refreshMotion(); }, { passive: true });
    finePointer.addEventListener("change", () => { resetScene(); measure(); });
    document.addEventListener("visibilitychange", () => { measure(); refreshMotion(); });

    if ("ResizeObserver" in window) new ResizeObserver(() => { measure(); refreshMotion(); }).observe(hero);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; refreshMotion(); }, { threshold: 0 }).observe(hero);
    }
    if ("MutationObserver" in window) {
      new MutationObserver(refreshMotion).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }

    return {
      setReducedMotion(value) {
        const next = Boolean(value);
        if (next === reduced) return;
        reduced = next;
        refreshMotion();
      },
    };
  };

  window.TryHardHero = Object.freeze({ create });
})();
