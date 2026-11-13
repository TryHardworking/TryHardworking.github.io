(() => {
  "use strict";

  // Approved sources are mirrored in index.html for a script-free preview.
  const portraitSources = {
    hero: "assets/images/portrait-hero.webp",
    about: "assets/images/portrait-about.webp",
  };

  const root = document.documentElement;
  const header = document.querySelector("[data-header]");
  const progress = document.querySelector("[data-scroll-progress]");
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-menu-dialog]");
  const caseDialog = document.querySelector("[data-case-dialog]");
  const motionToggle = document.querySelector("[data-motion-toggle]");
  const revealNodes = [...document.querySelectorAll("[data-reveal]")];
  const motionKey = "tryhard-portfolio-next-reduced-motion";
  let revealObserver;
  let lastCaseTrigger;
  let scrollFrame = 0;
  let userReducedMotion = false;

  try {
    userReducedMotion = localStorage.getItem(motionKey) === "true";
  } catch {
    // Storage is optional; private browsing and file previews still work.
  }

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const syncOverlay = () => {
    document.body.classList.toggle("overlay-open", Boolean(document.querySelector("dialog[open]")));
  };

  const closeOnBackdrop = (dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) dialog.close();
    });
  };

  if (menu && menuToggle && typeof menu.showModal === "function") {
    menuToggle.hidden = false;
    root.classList.add("menu-ready");

    menuToggle.addEventListener("click", () => {
      menu.showModal();
      menuToggle.setAttribute("aria-expanded", "true");
      syncOverlay();
    });

    menu.querySelector("[data-menu-close]")?.addEventListener("click", () => menu.close());
    menu.querySelectorAll("nav a").forEach((link) => {
      link.addEventListener("click", () => menu.close());
    });

    menu.addEventListener("close", () => {
      menuToggle.setAttribute("aria-expanded", "false");
      syncOverlay();
      menuToggle.focus({ preventScroll: true });
    });

    window.matchMedia("(min-width: 681px)").addEventListener("change", (event) => {
      if (event.matches && menu.open) menu.close();
    });

    closeOnBackdrop(menu);
  }

  if (caseDialog && typeof caseDialog.showModal === "function") {
    const projects = [...document.querySelectorAll("[data-project]")];

    projects.forEach((card, index) => {
      const trigger = card.querySelector("[data-case-open]");
      const template = card.querySelector("[data-case-template]");
      const title = card.querySelector("h3");
      const image = card.querySelector(".project-image");
      const link = card.querySelector("[data-project-url]");
      if (!trigger || !template || !title || !image || !link) return;

      trigger.hidden = false;
      trigger.addEventListener("click", () => {
        lastCaseTrigger = trigger;
        caseDialog.querySelector("[data-case-number]").textContent = String(index + 1).padStart(2, "0");
        caseDialog.querySelector("[data-case-title]").textContent = title.textContent.trim();
        caseDialog.querySelector("[data-case-body]").replaceChildren(template.content.cloneNode(true));
        caseDialog.querySelector("[data-case-url]").href = link.href;

        const preview = image.cloneNode();
        preview.loading = "eager";
        preview.removeAttribute("class");
        caseDialog.querySelector("[data-case-image]").replaceChildren(preview);
        caseDialog.showModal();
        caseDialog.scrollTop = 0;
        syncOverlay();
      });
    });

    caseDialog.querySelector("[data-case-close]")?.addEventListener("click", () => caseDialog.close());
    caseDialog.addEventListener("close", () => {
      syncOverlay();
      lastCaseTrigger?.focus({ preventScroll: true });
    });
    closeOnBackdrop(caseDialog);
  }

  Object.entries(portraitSources).forEach(([slot, source]) => {
    if (!source) return;
    const portrait = document.querySelector(`[data-portrait-slot="${slot}"]`);
    const canvas = portrait?.querySelector(".portrait-canvas");
    if (!canvas) return;

    // Both approved portraits are also in HTML and work without JavaScript.
    const existingImage = canvas.querySelector("img.portrait-photo");
    const image = existingImage || new Image();
    image.className = "portrait-photo";
    image.alt = slot === "hero" ? "Автор TRY/HARD — портрет на стуле" : "Автор TRY/HARD — за кадром";
    image.decoding = "async";
    image.loading = slot === "hero" ? "eager" : "lazy";
    image.addEventListener("load", () => portrait.classList.add("is-loaded"), { once: true });
    const showFallback = () => {
      portrait.classList.remove("is-loaded");
      image.remove();
    };
    image.addEventListener("error", showFallback, { once: true });
    if (image.getAttribute("src") !== source) image.src = source;
    if (!existingImage) canvas.append(image);
    if (image.complete) {
      if (image.naturalWidth > 0) portrait.classList.add("is-loaded");
      else showFallback();
    }
  });

  const heroExperience = window.TryHardHero?.create({ reduced: userReducedMotion });
  const sectionExperience = window.TryHardSections?.create({ reduced: userReducedMotion });

  const applyMotionPreference = () => {
    // Approved full autoplay, including reduced-motion systems; the footer still disables it.
    const reduced = userReducedMotion;
    revealObserver?.disconnect();
    root.classList.toggle("motion-autoplay", !reduced);
    root.classList.toggle("motion-reduced", reduced);
    root.classList.remove("motion-ready");
    heroExperience?.setReducedMotion(reduced);
    sectionExperience?.setReducedMotion(reduced);

    if (motionToggle) {
      motionToggle.hidden = false;
      motionToggle.disabled = false;
      motionToggle.setAttribute("aria-pressed", String(reduced));
      motionToggle.title = reduced ? "Вернуть анимации и плавную прокрутку" : "Отключить анимации и плавную прокрутку";
    }

    if (reduced || !("IntersectionObserver" in window)) {
      revealNodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -14px 0px" });

    revealNodes.forEach((node) => {
      if (!node.classList.contains("is-visible")) revealObserver.observe(node);
    });
    root.classList.add("motion-ready");
  };

  motionToggle?.addEventListener("click", () => {
    userReducedMotion = !userReducedMotion;
    try {
      localStorage.setItem(motionKey, String(userReducedMotion));
    } catch {
      // No persistence is required for the control to work.
    }
    applyMotionPreference();
  });

  applyMotionPreference();

  const navLinks = [...document.querySelectorAll(".site-nav a")];
  const navSections = navLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);

  const updateScroll = () => {
    scrollFrame = 0;
    header?.classList.toggle("is-scrolled", window.scrollY > 24);
    const maxScroll = root.scrollHeight - window.innerHeight;
    const ratio = maxScroll > 0 ? Math.max(0, Math.min(1, window.scrollY / maxScroll)) : 0;
    if (progress) progress.style.transform = `scaleX(${ratio})`;

    const line = window.scrollY + 170;
    const current = [...navSections].reverse().find((section) => section.offsetTop <= line);
    navLinks.forEach((link) => {
      const active = current && link.getAttribute("href") === `#${current.id}`;
      link.classList.toggle("is-current", Boolean(active));
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  const requestScrollUpdate = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  };

  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate, { passive: true });
  updateScroll();
})();
