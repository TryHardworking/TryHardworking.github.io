import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(project, "..");
const tempRoot = join(process.env.LOCALAPPDATA || process.env.TEMP, "Temp", "opencode");
const output = join(tempRoot, `sdvig-qa-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const profile = join(tempRoot, `sdvig-profile-${randomUUID()}`);
const browserPath = [
  process.env.BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2" };
const checks = [];
const documents = [];
let browser;
let server;
let socket;
let session;
let sequence = 0;
let events = [];
const pending = new Map();
const listeners = new Set();

await Promise.all([mkdir(output, { recursive: true }), mkdir(profile, { recursive: true })]);

async function existingBrowser() {
  for (const path of browserPath) {
    try { if ((await stat(path)).isFile()) return path; } catch { /* Try the next candidate. */ }
  }
  throw new Error("Microsoft Edge or Google Chrome was not found. Set BROWSER_PATH.");
}

function serve() {
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = "/sdvig/";
      let path = normalize(join(root, pathname));
      if (path !== root && !path.startsWith(`${root}${sep}`)) throw new Error("Outside root");
      if ((await stat(path)).isDirectory()) path = join(path, "index.html");
      const body = await readFile(path);
      response.writeHead(200, { "Content-Type": mime[extname(path).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen(`http://127.0.0.1:${server.address().port}/sdvig/`));
  });
}

function command(method, params = {}, browserCommand = false) {
  return new Promise((resolveCommand, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
    pending.set(id, { resolve: resolveCommand, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(!browserCommand && session ? { sessionId: session } : {}) }));
  });
}

function nextEvent(method) {
  return new Promise((resolveEvent, reject) => {
    const listener = (event) => {
      if (event.method !== method || event.sessionId !== session) return;
      clearTimeout(timeout);
      listeners.delete(listener);
      resolveEvent(event);
    };
    const timeout = setTimeout(() => { listeners.delete(listener); reject(new Error(`${method} did not arrive`)); }, 30000);
    listeners.add(listener);
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function settle() {
  await evaluate(`(async()=>{
    document.querySelectorAll('img').forEach(image=>image.loading='eager');
    for(const image of document.images){ image.scrollIntoView({behavior:'instant',block:'center'}); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); }
    await Promise.allSettled([...document.images].map(image=>image.decode()));
    await document.fonts.ready;
    window.scrollTo({top:0,behavior:'instant'});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return true;
  })()`);
}

async function viewport(width, height = width <= 700 ? 844 : 1000) {
  await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 700 });
}

async function navigate(base) {
  events = [];
  const loaded = nextEvent("Page.loadEventFired");
  await command("Page.navigate", { url: base });
  await loaded;
  await settle();
}

async function capture(name, width, height) {
  await evaluate("window.scrollTo({top:0,behavior:'instant'}); true");
  const format = name.endsWith(".webp") ? "webp" : "png";
  const image = await command("Page.captureScreenshot", { format, ...(format === "webp" ? { quality: 84 } : {}), captureBeyondViewport: false, clip: { x: 0, y: 0, width, height, scale: 1 } });
  await writeFile(join(output, name), Buffer.from(image.data, "base64"));
}

async function press(key, code, keyCode, modifiers = 0) {
  const text = key === "Enter" ? "\r" : key === " " ? " " : "";
  await command("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers, ...(text ? { text, unmodifiedText: text } : {}) });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers });
  await evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))");
}

async function check(name, operation) {
  try {
    const detail = await operation();
    checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) });
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
  }
  await writeFile(join(output, "results.partial.json"), JSON.stringify(checks, null, 2));
}

function assert(condition, message) {
  if (!condition) throw new Error(typeof message === "string" ? message : JSON.stringify(message));
}

try {
  const base = process.argv[2] || await serve();
  const executable = await existingBrowser();
  browser = spawn(executable, ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", "--no-first-run", "--disable-sync", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  const debuggerUrl = await new Promise((resolveDebugger, reject) => {
    let stderr = "";
    const timeout = setTimeout(() => reject(new Error("Browser did not start")), 30000);
    browser.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timeout); resolveDebugger(match[1]); }
    });
    browser.once("error", reject);
  });
  socket = new WebSocket(debuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener("open", resolveOpen, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
    } else if (message.method) {
      events.push(message);
      for (const listener of listeners) listener(message);
    }
  });
  const target = await command("Target.createTarget", { url: "about:blank" }, true);
  session = (await command("Target.attachToTarget", { targetId: target.targetId, flatten: true }, true)).sessionId;
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Network.setCacheDisabled", { cacheDisabled: true });
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });

  for (const width of [320, 360, 390, 500, 700, 768, 1024, 1440, 1920]) {
    const height = width <= 700 ? 844 : 1000;
    await viewport(width, height);
    await navigate(base);
    await check(`Layout and resources at ${width}px`, async () => {
      const data = await evaluate(`(()=>{
        const html=document.documentElement;
        const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height}};
        return {
          width:innerWidth,clientWidth:html.clientWidth,scrollWidth:html.scrollWidth,
          title:document.title,cards:document.querySelectorAll('.product-card').length,
          portfolioLink:[...document.querySelectorAll('.footer-grid a')].find(link=>link.textContent.includes('TRY/HARD portfolio'))?.href,
          fonts:[...document.fonts].map(font=>({family:font.family,status:font.status})),
          brokenImages:[...document.images].filter(image=>!image.complete||!image.naturalWidth).map(image=>image.currentSrc||image.src),
          revealHidden:[...document.querySelectorAll('[data-reveal]')].filter(node=>getComputedStyle(node).opacity==='0').length,
          header:rect(document.querySelector('.site-header')),h1:rect(document.querySelector('h1')),
          menuDisplay:getComputedStyle(document.querySelector('[data-menu-open]')).display,
          hiddenLeaks:[...document.querySelectorAll('[hidden]')].filter(node=>getComputedStyle(node).display!=='none').length
        };
      })()`);
      const bad = events.filter(({ method, params }) => method === "Runtime.exceptionThrown" ||
        (method === "Runtime.consoleAPICalled" && params.type === "error") ||
        (method === "Network.responseReceived" && params.response.status >= 400) ||
        (method === "Network.loadingFailed" && !params.canceled) ||
        (method === "Network.requestWillBeSent" && (params.request.method !== "GET" && params.request.method !== "HEAD" || !params.request.url.startsWith(new URL(base).origin))));
      assert(data.scrollWidth <= data.clientWidth + 1, data);
      assert(data.cards === 12 && data.brokenImages.length === 0 && data.revealHidden === 0 && data.hiddenLeaks === 0, data);
      assert(data.portfolioLink === 'https://tryhardworking.github.io/', data);
      assert(data.fonts.every((font) => font.status === "loaded"), data.fonts);
      assert(data.header.left >= -1 && data.header.right <= data.clientWidth + 1 && data.h1.left >= -1 && data.h1.right <= data.clientWidth + 1, data);
      assert(width > 900 ? data.menuDisplay === "none" : data.menuDisplay !== "none", data);
      assert(bad.length === 0, bad.map((event) => ({ method: event.method, params: event.params })));
      documents.push(data);
      return { width: data.width, scrollWidth: data.scrollWidth, cards: data.cards };
    });
    if (width === 390) await capture("sdvig-390.png", width, height);
    if (width === 1440) await capture("sdvig-1440.webp", width, height);
  }

  await viewport(390, 844);
  await navigate(base);
  await evaluate("localStorage.clear(); true");
  await navigate(base);

  await check("Keyboard mobile menu, native focus trap and Escape", async () => {
    await evaluate("document.querySelector('[data-menu-open]').focus(); true");
    await press("Enter", "Enter", 13);
    assert(await evaluate("document.querySelector('#menu-dialog').open && document.activeElement.closest('#menu-dialog')"), "Menu did not open with Enter");
    for (let index = 0; index < 8; index++) {
      await press("Tab", "Tab", 9);
      assert(await evaluate("!!document.activeElement.closest('#menu-dialog')"), `Tab escaped at step ${index}`);
    }
    await press("Escape", "Escape", 27);
    assert(await evaluate("!document.querySelector('#menu-dialog').open && document.activeElement.matches('[data-menu-open]')"), "Escape did not close menu and restore focus");
  });

  await check("Search, categories, favorites and reset", async () => {
    const result = await evaluate(`(()=>{
      const search=document.querySelector('[data-search]');
      document.querySelector('[data-filter-toggle]').click();
      search.value='Орбита'; search.dispatchEvent(new Event('input',{bubbles:true}));
      const searchCount=document.querySelectorAll('.product-card').length;
      document.querySelector('[data-search-clear]').click();
      document.querySelector('[data-category="outerwear"]').click();
      const outerwearCount=document.querySelectorAll('.product-card').length;
      document.querySelector('[data-filter-reset]').click();
      document.querySelector('[data-favorite="pause"]').click();
      document.querySelector('[data-favorites-open]').click();
      const favoriteCount=document.querySelectorAll('.product-card').length;
      document.querySelector('[data-filter-reset]').click();
      return {searchCount,outerwearCount,favoriteCount,total:document.querySelectorAll('.product-card').length,favorites:JSON.parse(localStorage.getItem('sdvig:shop:v1')).favorites};
    })()`);
    assert(result.searchCount === 1 && result.outerwearCount === 2 && result.favoriteCount === 1 && result.total === 12 && result.favorites[0] === "pause", result);
    return result;
  });

  await check("Product color, back view, size, cart stock and toast", async () => {
    const result = await evaluate(`(()=>{
      const opener=document.querySelector('[data-product-grid] [data-open-product="pause"]'); opener.focus(); opener.click();
      document.querySelector('[data-product-select-color="lilac"]').click();
      document.querySelector('[data-product-select-size="S"]').click();
      document.querySelector('[data-view="back"]').click();
      const before={open:document.querySelector('#product-dialog').open,src:document.querySelector('[data-product-image]').getAttribute('src'),size:document.querySelector('[data-product-select-size="S"]').getAttribute('aria-pressed')};
      document.querySelector('[data-product-add]').click();
      return {before,cart:JSON.parse(localStorage.getItem('sdvig:shop:v1')).cart,count:document.querySelector('.site-header [data-cart-count]').textContent,toast:document.querySelector('[data-toast]').textContent};
    })()`);
    assert(result.before.open && result.before.src.endsWith("pause-lilac-back.svg") && result.before.size === "true", result);
    assert(result.cart.length === 1 && result.cart[0].color === "lilac" && result.cart[0].size === "S" && result.count === "1", result);
    return result;
  });

  await check("Product Escape closes and restores focused opener", async () => {
    await press("Escape", "Escape", 27);
    const result = await evaluate("({open:document.querySelector('#product-dialog').open,focus:document.activeElement.dataset.openProduct})");
    assert(!result.open && result.focus === "pause", result);
    return result;
  });

  await check("Cart quantity, coupon and delivery recalculate correctly", async () => {
    const result = await evaluate(`(()=>{
      document.querySelector('.site-header [data-cart-open]').click();
      document.querySelector('[data-cart-change="1"]').click();
      const coupon=document.querySelector('[data-coupon-form] input'); coupon.value='sdvig10'; document.querySelector('[data-coupon-form]').requestSubmit();
      document.querySelector('[name="cart-delivery"][value="courier"]').click();
      return {quantity:JSON.parse(localStorage.getItem('sdvig:shop:v1')).cart[0].quantity,coupon:JSON.parse(localStorage.getItem('sdvig:shop:v1')).coupon,total:document.querySelector('[data-total]').textContent.replace(/[^0-9]/g,''),delivery:document.querySelector('[data-delivery-price]').textContent.replace(/[^0-9]/g,'')};
    })()`);
    assert(result.quantity === 2 && result.coupon === "SDVIG10" && result.total === "7670" && result.delivery === "650", result);
    return result;
  });

  await check("Checkout reports every missing required value", async () => {
    const result = await evaluate(`(()=>{
      document.querySelector('[data-checkout-open]').click();
      document.querySelector('[data-checkout-form]').requestSubmit();
      return {open:document.querySelector('#checkout-dialog').open,focus:document.activeElement.name,errors:Object.fromEntries([...document.querySelectorAll('[data-error-for]')].map(node=>[node.dataset.errorFor,node.textContent]))};
    })()`);
    assert(result.open && result.focus === "name" && Object.values(result.errors).filter(Boolean).length === 5, result);
    return result;
  });

  await check("Valid demonstration checkout sends nothing and clears personal fields", async () => {
    const result = await evaluate(`(()=>{
      const form=document.querySelector('[data-checkout-form]');
      const values={name:'Тест',email:'test@example.ru',phone:'+7 999 123-45-67',address:'Киров, Ленина, 1'};
      for(const [name,value] of Object.entries(values)){form.elements[name].value=value;form.elements[name].dispatchEvent(new Event('input',{bubbles:true}));}
      form.elements.consent.checked=true;form.elements.consent.dispatchEvent(new Event('input',{bubbles:true}));
      form.requestSubmit();
      return {success:document.querySelector('#success-dialog').open,cart:JSON.parse(localStorage.getItem('sdvig:shop:v1')).cart,stored:localStorage.getItem('sdvig:shop:v1'),fields:Object.fromEntries(Object.keys(values).map(name=>[name,form.elements[name].value])),order:document.querySelector('[data-order-number]').textContent};
    })()`);
    assert(result.success && result.cart.length === 0 && Object.values(result.fields).every((value) => value === "") && /^SDV-26-[0-9A-F]{4}$/.test(result.order), result);
    assert(!result.stored.includes("test@example") && !result.stored.includes("999"), result.stored);
    const badRequests = events.filter(({ method, params }) => method === "Network.requestWillBeSent" && !["GET", "HEAD"].includes(params.request.method));
    assert(badRequests.length === 0, badRequests);
    return result;
  });

  await check("Complete look adds three valid lines atomically", async () => {
    const result = await evaluate(`(()=>{
      document.querySelector('[data-success-close]').click();
      document.querySelector('[data-add-look]').click();
      const state=JSON.parse(localStorage.getItem('sdvig:shop:v1'));
      document.querySelector('.site-header [data-cart-open]').click();
      return {lines:state.cart.length,quantity:Number(document.querySelector('[data-cart-title-count]').textContent),shipping:document.querySelector('[data-shipping-message]').textContent,total:document.querySelector('[data-total]').textContent.replace(/[^0-9]/g,'')};
    })()`);
    assert(result.lines === 3 && result.quantity === 3 && result.shipping.includes("разблокирована") && result.total === "13300", result);
    return result;
  });

  await capture("sdvig-mobile-cart.png", 390, 844);
  const finalBad = events.filter(({ method, params }) => method === "Runtime.exceptionThrown" || (method === "Runtime.consoleAPICalled" && params.type === "error") || (method === "Network.responseReceived" && params.response.status >= 400) || (method === "Network.loadingFailed" && !params.canceled));
  await check("No uncaught errors or failed resources during interactions", async () => assert(finalBad.length === 0, finalBad));

  const report = { generatedAt: new Date().toISOString(), base, output, passed: checks.every((item) => item.passed), passedCount: checks.filter((item) => item.passed).length, failedCount: checks.filter((item) => !item.passed).length, checks, documents };
  await writeFile(join(output, "results.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, passed: report.passed, passedCount: report.passedCount, failedCount: report.failedCount, failed: checks.filter((item) => !item.passed) }, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally {
  try { socket?.close(); } catch { /* Already closed. */ }
  try { if (browser && browser.exitCode === null) { const exited = once(browser, "exit"); browser.kill(); await exited; } } catch { /* Best effort. */ }
  await new Promise((resolveClose) => server ? server.close(resolveClose) : resolveClose());
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
