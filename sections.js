(() => {
  "use strict";

  // Independent, progressively enhanced scenes. Scroll and native controls stay native.
  const create = ({ reduced = false } = {}) => {
    const elements = [...document.querySelectorAll("[data-scene]")];
    if (!elements.length) return null;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const hasObserver = "IntersectionObserver" in window;
    const animations = new Map();
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const scenes = elements.map((element) => ({
      element,
      variables: new Map(),
      nodes: [...element.querySelectorAll("[data-scene-enter]")].map((node) => ({
        element: node, lines: [...node.querySelectorAll("[data-type-line]")], visible: false, entered: !hasObserver, epoch: 0,
      })),
      cards: [...element.querySelectorAll("[data-depth-card]")].map((card) => ({
        element: card, rect: null, variables: new Map(), x: 0, y: 0, targetX: 0, targetY: 0,
      })),
      pointer: { x: 0, y: 0, targetX: 0, targetY: 0 },
      parallax: element.querySelector(".portrait--about"),
      bounds: null,
      parallaxBounds: null,
      scroll: 0,
      targetScroll: 0,
      inView: false,
      running: false,
      mode: "",
    }));
    let interactionFrame = 0;
    let measureFrame = 0;
    let lastFrame = 0;

    const setVariable = (element, cache, name, value) => {
      if (cache.get(name) === value) return;
      cache.set(name, value);
      element.style.setProperty(name, value);
    };

    const cancelAnimations = (scene, target) => {
      animations.forEach((record, animation) => {
        if (record.scene !== scene || (target && record.target !== target)) return;
        animations.delete(animation);
        animation.cancel();
      });
    };

    const animate = (scene, owner, target, keyframes, options) => {
      if (!scene.running || (owner && !owner.visible) || !target?.animate) return null;
      const animation = target.animate(keyframes, { fill: "both", ...options });
      animations.set(animation, { scene, owner, target });
      animation.finished.then(() => {
        animations.delete(animation);
        animation.cancel();
      }, () => animations.delete(animation));
      return animation;
    };

    const playIntro = (scene, node) => {
      if (node.entered || !node.visible || !scene.running) return;
      node.entered = true;
      const epoch = ++node.epoch;
      node.element.dataset.sceneEntered = "playing";
      const delay = innerWidth > 680 && node.element.matches(".project-card:nth-child(even), .expertise-card:nth-child(2)") ? 85 : 0;
      const intro = [animate(scene, node, node.element, [
        { opacity: 0, transform: `translateY(${node.element.matches(".portrait") ? 34 : 24}px)` },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: 950, delay, easing: "cubic-bezier(.22,1,.36,1)" })];

      node.lines.forEach((line, index) => {
        intro.push(animate(scene, node, line, [
          { opacity: .2, transform: "translateY(113%) rotate(1.5deg)" },
          { opacity: 1, transform: "translateY(0) rotate(0deg)" },
        ], { duration: 1100, delay: delay + 70 + index * 125, easing: "cubic-bezier(.16,1,.3,1)" }));
      });
      Promise.allSettled(intro.filter(Boolean).map((animation) => animation.finished)).then(() => {
        if (node.epoch === epoch) node.element.dataset.sceneEntered = "complete";
      });
    };

    const refreshNode = (scene, node) => {
      node.element.dataset.sceneVisible = String(node.visible);
      playIntro(scene, node);
      animations.forEach((record, animation) => {
        if (record.scene !== scene || record.owner !== node) return;
        if (scene.running && node.visible) animation.play();
        else animation.pause();
      });
    };

    const updateTargets = (scene) => {
      const bounds = scene.parallaxBounds;
      scene.targetScroll = bounds && finePointer.matches && innerWidth > 680
        ? clamp((scrollY + innerHeight / 2 - bounds.top - bounds.height / 2) / (innerHeight / 2 + bounds.height / 2), -1, 1)
        : 0;
    };

    const hasPendingInteraction = (scene) => scene.running && (
      Math.abs(scene.scroll - scene.targetScroll) > .0005 ||
      Math.abs(scene.pointer.x - scene.pointer.targetX) > .0005 ||
      Math.abs(scene.pointer.y - scene.pointer.targetY) > .0005 ||
      scene.cards.some((card) => Math.abs(card.x - card.targetX) > .0005 || Math.abs(card.y - card.targetY) > .0005)
    );

    const ease = (value, target, smoothing) => Math.abs(target - value) < .0005 ? target : value + (target - value) * smoothing;

    const tick = (now) => {
      interactionFrame = 0;
      const smoothing = 1 - Math.exp(-Math.min(lastFrame ? now - lastFrame : 16, 64) / 100);
      lastFrame = now;
      scenes.forEach((scene) => {
        if (!scene.running) return;
        scene.scroll = ease(scene.scroll, scene.targetScroll, smoothing);
        scene.pointer.x = ease(scene.pointer.x, scene.pointer.targetX, smoothing);
        scene.pointer.y = ease(scene.pointer.y, scene.pointer.targetY, smoothing);
        if (scene.parallax) setVariable(scene.element, scene.variables, "--scene-scroll", scene.scroll.toFixed(3));
        if (scene.element.id === "contact") {
          setVariable(scene.element, scene.variables, "--scene-pointer-x", scene.pointer.x.toFixed(3));
          setVariable(scene.element, scene.variables, "--scene-pointer-y", scene.pointer.y.toFixed(3));
        }
        scene.cards.forEach((card) => {
          card.x = ease(card.x, card.targetX, smoothing);
          card.y = ease(card.y, card.targetY, smoothing);
          setVariable(card.element, card.variables, "--depth-x", card.x.toFixed(3));
          setVariable(card.element, card.variables, "--depth-y", card.y.toFixed(3));
        });
      });
      if (scenes.some(hasPendingInteraction)) interactionFrame = requestAnimationFrame(tick);
      else lastFrame = 0;
    };

    const requestInteraction = () => {
      if (!interactionFrame && scenes.some(hasPendingInteraction)) interactionFrame = requestAnimationFrame(tick);
      if (interactionFrame && !scenes.some(hasPendingInteraction)) {
        cancelAnimationFrame(interactionFrame);
        interactionFrame = 0;
        lastFrame = 0;
      }
    };

    const resetInteraction = (scene) => {
      scene.scroll = scene.targetScroll = 0;
      scene.pointer.x = scene.pointer.y = scene.pointer.targetX = scene.pointer.targetY = 0;
      setVariable(scene.element, scene.variables, "--scene-scroll", "0");
      setVariable(scene.element, scene.variables, "--scene-pointer-x", "0");
      setVariable(scene.element, scene.variables, "--scene-pointer-y", "0");
      scene.cards.forEach((card) => {
        card.x = card.y = card.targetX = card.targetY = 0;
        card.rect = null;
        setVariable(card.element, card.variables, "--depth-x", "0");
        setVariable(card.element, card.variables, "--depth-y", "0");
      });
    };

    const refreshScene = (scene) => {
      const overlay = document.body.classList.contains("overlay-open") || Boolean(document.querySelector("dialog[open]"));
      const mode = reduced ? "reduced" : document.hidden ? "hidden" : overlay ? "overlay" : !scene.inView ? "offscreen" : "running";
      scene.element.dataset.sceneMotion = mode;
      scene.element.classList.toggle("scene-motion-enabled", !reduced);
      scene.element.classList.toggle("scene-motion-running", mode === "running");
      scene.element.classList.toggle("scene--paused", reduced);
      if (scene.mode === mode) return;
      scene.mode = mode;
      scene.running = mode === "running";

      if (reduced) {
        cancelAnimations(scene);
        scene.nodes.forEach((node) => {
          node.entered = true;
          node.epoch++;
          node.element.dataset.sceneEntered = "complete";
        });
        resetInteraction(scene);
      } else {
        // Keep playheads and depth values intact through pause, overlays and visibility changes.
        animations.forEach((record, animation) => {
          if (record.scene !== scene) return;
          if (scene.running && (!record.owner || record.owner.visible)) animation.play();
          else animation.pause();
        });
        if (scene.running) {
          if (!scene.element.matches(":hover")) scene.pointer.targetX = scene.pointer.targetY = 0;
          scene.cards.forEach((card) => {
            if (!card.element.matches(":hover")) card.targetX = card.targetY = 0;
          });
          updateTargets(scene);
          scene.nodes.forEach((node) => refreshNode(scene, node));
        }
      }
      requestInteraction();
    };

    const refreshAll = () => scenes.forEach(refreshScene);

    const measure = () => {
      measureFrame = 0;
      const geometry = scenes.map((scene) => ({
        scene, rect: scene.element.getBoundingClientRect(),
        parallax: scene.parallax?.getBoundingClientRect(),
        nodes: scene.nodes.map((node) => ({ node, rect: node.element.getBoundingClientRect() })),
      }));
      geometry.forEach(({ scene, rect, parallax, nodes }) => {
        scene.bounds = { left: rect.left, top: rect.top + scrollY, width: rect.width, height: rect.height };
        scene.parallaxBounds = parallax ? { top: parallax.top + scrollY, height: parallax.height } : null;
        // Match IntersectionObserver: touching the viewport edge is intersecting too.
        // Otherwise a later measurement can overwrite its state without a new crossing.
        scene.inView = rect.bottom >= 0 && rect.top <= innerHeight;
        scene.cards.forEach((card) => { card.rect = null; });
        nodes.forEach(({ node, rect: nodeRect }) => { node.visible = nodeRect.bottom >= 0 && nodeRect.top <= innerHeight; });
        updateTargets(scene);
        refreshScene(scene);
        scene.nodes.forEach((node) => refreshNode(scene, node));
      });
      requestInteraction();
    };

    const requestMeasure = () => {
      if (!measureFrame) measureFrame = requestAnimationFrame(measure);
    };

    scenes.forEach((scene) => {
      // Let app.js keep simple reveals elsewhere; these nodes use their own native animations.
      scene.nodes.forEach((node) => node.element.classList.add("is-visible"));
      if (scene.element.id === "contact") {
        scene.element.addEventListener("pointermove", (event) => {
          if (!scene.running || !finePointer.matches || innerWidth <= 680 || event.pointerType === "touch") return;
          const bounds = scene.bounds;
          scene.pointer.targetX = clamp(((event.clientX - bounds.left) / bounds.width - .5) * 2, -1, 1);
          scene.pointer.targetY = clamp(((event.clientY + scrollY - bounds.top) / bounds.height - .5) * 2, -1, 1);
          requestInteraction();
        }, { passive: true });
        scene.element.addEventListener("pointerleave", () => {
          scene.pointer.targetX = scene.pointer.targetY = 0;
          requestInteraction();
        });
      }

      scene.cards.forEach((card) => {
        card.element.addEventListener("pointerenter", () => { card.rect = card.element.getBoundingClientRect(); });
        card.element.addEventListener("pointermove", (event) => {
          if (!scene.running || !finePointer.matches || innerWidth <= 680 || event.pointerType === "touch") return;
          const rect = card.rect || (card.rect = card.element.getBoundingClientRect());
          card.targetX = clamp(((event.clientX - rect.left) / rect.width - .5) * 2, -1, 1);
          card.targetY = clamp(((event.clientY - rect.top) / rect.height - .5) * 2, -1, 1);
          requestInteraction();
        }, { passive: true });
        const release = () => { card.targetX = card.targetY = 0; requestInteraction(); };
        card.element.addEventListener("pointerleave", release);
        card.element.addEventListener("focus", release);
      });
    });

    const process = scenes.find((scene) => scene.element.id === "process");
    if (process) {
      const steps = [...process.element.querySelectorAll(".process-step")];
      const number = process.element.querySelector("[data-process-number]");
      const progress = process.element.querySelector("[data-process-progress]");
      process.element.querySelector("[data-process-map]")?.removeAttribute("hidden");
      let current = -2;
      const updateProcess = (withAnimation = true) => {
        const index = steps.findIndex((step) => step.open);
        if (index === current) return;
        current = index;
        process.element.dataset.processActiveStep = String(index + 1);
        if (number) {
          cancelAnimations(process, number);
          number.textContent = index < 0 ? "—" : String(index + 1).padStart(2, "0");
          if (withAnimation) animate(process, process.nodes.find((node) => node.element.contains(number)), number, [
            { opacity: .35, transform: "translateY(9px)" },
            { opacity: 1, transform: "translateY(0)" },
          ], { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" });
        }
        if (progress) progress.style.transform = `scaleX(${index < 0 ? 0 : (index + 1) / steps.length})`;
        if (withAnimation && index >= 0) {
          const body = steps[index].querySelector(".step-body");
          const rect = body.getBoundingClientRect();
          cancelAnimations(process, body);
          if (rect.bottom > 0 && rect.top < innerHeight) animate(process, process.nodes.find((node) => node.element.contains(body)), body, [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "translateY(0)" },
          ], { duration: 540, easing: "cubic-bezier(.22,1,.36,1)" });
        }
        requestMeasure();
      };
      // No preventDefault or synthetic accordion: <details name> owns open/close and keys.
      steps.forEach((step) => step.addEventListener("toggle", () => updateProcess()));
      updateProcess(false);
    }

    measure();
    if (hasObserver) {
      const sceneObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const scene = scenes.find((candidate) => candidate.element === entry.target);
          scene.inView = entry.isIntersecting;
          refreshScene(scene);
        });
      }, { threshold: 0 });
      const nodeObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const scene = scenes.find((candidate) => candidate.element.contains(entry.target));
          const node = scene.nodes.find((candidate) => candidate.element === entry.target);
          node.visible = entry.isIntersecting;
          refreshNode(scene, node);
        });
      }, { threshold: 0 });
      scenes.forEach((scene) => {
        sceneObserver.observe(scene.element);
        scene.nodes.forEach((node) => nodeObserver.observe(node.element));
      });
    }
    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(requestMeasure);
      scenes.forEach((scene) => resizeObserver.observe(scene.element));
    }
    if ("MutationObserver" in window) {
      const overlayObserver = new MutationObserver(refreshAll);
      overlayObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      document.querySelectorAll("dialog").forEach((dialog) => overlayObserver.observe(dialog, { attributes: true, attributeFilter: ["open"] }));
    }
    window.addEventListener("scroll", () => {
      scenes.forEach((scene) => {
        updateTargets(scene);
        scene.cards.forEach((card) => { card.rect = null; });
      });
      if (!hasObserver) requestMeasure();
      requestInteraction();
    }, { passive: true });
    window.addEventListener("resize", () => {
      if (innerWidth <= 680) scenes.forEach(resetInteraction);
      requestMeasure();
    }, { passive: true });
    finePointer.addEventListener("change", () => { scenes.forEach(resetInteraction); requestMeasure(); });
    document.addEventListener("visibilitychange", () => { refreshAll(); if (!document.hidden) requestMeasure(); });
    document.fonts?.ready.then(requestMeasure);

    return {
      setReducedMotion(value) {
        const next = Boolean(value);
        if (next === reduced) return;
        reduced = next;
        refreshAll();
      },
    };
  };

  window.TryHardSections = Object.freeze({ create });
})();
