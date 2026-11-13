import { mkdir, copyFile, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTS, COLORS } from "../js/catalog.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fonts = resolve(root, "assets/fonts");
const images = resolve(root, "assets/images");
const products = resolve(root, "assets/products");
await Promise.all([fonts, images, products].map((path) => mkdir(path, { recursive: true })));

async function download(url, path) {
  try { await access(path); return; } catch { /* Only fetch missing assets. */ }
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

await Promise.all(["cyrillic", "latin"].map((subset) => copyFile(
  resolve(root, `../portfolio/assets/fonts/manrope-${subset}.woff2`),
  resolve(fonts, `manrope-${subset}.woff2`),
)));

const fontResponse = await fetch("https://fonts.googleapis.com/css2?family=Oswald:wght@400..700&display=swap", {
  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
  signal: AbortSignal.timeout(45000),
});
if (!fontResponse.ok) throw new Error(`Font CSS: ${fontResponse.status}`);
const css = await fontResponse.text();
for (const subset of ["cyrillic", "latin"]) {
  const block = css.match(new RegExp(`/\\* ${subset} \\*/([\\s\\S]*?)(?=/\\*|$)`));
  const url = block?.[1].match(/url\((https:[^)]+)\)/)?.[1];
  if (!url) throw new Error(`Oswald ${subset} font URL not found`);
  await download(url, resolve(fonts, `oswald-${subset}.woff2`));
}

await Promise.all([
  download("https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/OFL.txt", resolve(fonts, "Oswald-OFL.txt")),
  download("https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt", resolve(fonts, "Manrope-OFL.txt")),
  download("https://images.unsplash.com/photo-1539109136881-3be0616acf4b?fit=crop&crop=faces&w=1400&h=1600&fm=webp&q=82&sat=-100", resolve(images, "campaign.webp")),
  download("https://images.unsplash.com/photo-1551232864-3f0890e580d9?fit=crop&w=1000&h=1100&fm=webp&q=80&sat=-100", resolve(images, "studio.webp")),
]);

// Original flat-lay illustrations, not photographs of another brand's products.
const silhouettes = {
  longsleeve: "M224 148 277 127Q320 157 363 127L416 148 481 199 547 475 486 495 411 266 405 650Q320 667 235 650L229 266 154 495 93 475 159 199Z",
  tee: "M225 177 275 153Q320 184 365 153L415 177 519 231 481 341 409 306 405 616Q320 632 235 616L231 306 159 341 121 231Z",
  shirt: "M226 140 279 123 320 147 361 123 414 140 477 194 535 504 475 523 411 280 410 651 332 665 230 650 229 280 165 523 105 504 163 194Z",
  hoodie: "M230 180 264 143Q246 83 275 72Q320 37 365 72 394 83 376 143L410 180 477 222 533 510 466 531 410 322 406 647Q320 663 234 647L230 322 174 531 107 510 163 222Z",
  knit: "M224 165 276 139Q320 164 364 139L416 165 482 214 542 513 475 536 410 291 409 646Q320 663 231 646L230 291 165 536 98 513 158 214Z",
  jacket: "M226 151 278 127 320 150 362 127 414 151 473 196 530 488 469 509 410 284 410 649 230 649 230 284 171 509 110 488 167 196Z",
  coat: "M244 95 280 83 320 115 360 83 396 95 449 140 496 431 442 448 394 258 419 715 221 715 246 258 198 448 144 431 191 140Z",
  trousers: "M227 114Q320 101 413 114L433 277 437 685 339 685 320 334 301 685 203 685 207 277Z",
  joggers: "M231 130Q320 114 409 130L426 276 412 654 335 654 320 352 305 654 228 654 214 276Z",
  skirt: "M242 170Q320 157 398 170L441 319 477 653Q320 689 163 653L199 319Z",
  bag: "M187 299 453 299 470 642Q320 681 170 642Z",
  beanie: "M207 390 207 284Q217 172 320 162 423 172 433 284L433 390 448 403 448 501Q320 537 192 501L192 403Z",
};

function drawing(product, variant, back = false) {
  const color = COLORS[variant.color];
  const path = silhouettes[product.type];
  const fabric = ["knit", "beanie"].includes(product.type) ? "knit" : "weave";
  const shortSleeve = product.type === "tee";
  const isTop = ["longsleeve", "tee", "shirt", "hoodie", "knit", "jacket", "coat"].includes(product.type);
  const bottom = ["trousers", "joggers"].includes(product.type);
  let details = "";
  if (isTop) {
    details += `<path d="M230 ${shortSleeve ? 306 : 280}Q248 342 240 603M410 ${shortSleeve ? 306 : 280}Q392 342 400 603"/><path d="M260 335Q277 421 261 527M378 366Q364 462 379 560" opacity=".34"/>`;
    if (["longsleeve", "tee", "knit"].includes(product.type)) {
      details += `<path d="M276 ${product.type === "tee" ? 154 : product.type === "knit" ? 140 : 128}Q320 ${product.type === "tee" ? 222 : 203} 364 ${product.type === "tee" ? 154 : product.type === "knit" ? 140 : 128}" stroke-width="9"/><path d="M245 ${shortSleeve ? 604 : 634}Q320 ${shortSleeve ? 619 : 650} 395 ${shortSleeve ? 604 : 634}" stroke-width="8"/>`;
    }
    if (["shirt", "jacket", "coat"].includes(product.type)) {
      const y = product.type === "coat" ? 89 : 131;
      details += `<path d="M280 ${y} 263 ${y + 55} 307 ${y + 91} 320 ${y + 24} 333 ${y + 91} 377 ${y + 55} 360 ${y}" fill="${color.hex}" stroke-width="3"/><path d="M320 ${y + 24}V${product.type === "coat" ? 698 : 644}" stroke-width="3"/>`;
      if (!back) details += [257, 326, 395, 464, 533, 602].map((y) => `<circle cx="327" cy="${y}" r="4" fill="#252229" stroke="none"/>`).join("");
      if (!back) details += product.type === "shirt" ? '<path d="M346 259h48v79q-24 18-48 0zM346 266h48"/>' : '<path d="M253 453h47v116h-47zM342 453h47v116h-47zM342 259h47v76h-47z"/>';
    }
    if (product.type === "hoodie") {
      details += '<path d="M266 144Q320 184 374 144M266 144Q279 91 320 83Q361 91 374 144M313 171v83M328 171v87" stroke-width="4"/>';
      if (!back) details += '<path d="M274 426h92l29 97v49H245v-49zM274 432l-24 91M366 432l24 91" stroke-width="3"/>';
    }
    if (back) details += '<path d="M239 227Q320 246 401 227" stroke-dasharray="3 5"/>';
    else details += `<path d="m${product.type === "coat" ? 272 : 279} ${product.type === "tee" ? 546 : 291}h13v13h-5v-8h-8m0 13 12-12" stroke="#ddfb79" stroke-width="3"/>`;
  }
  if (bottom) {
    details += '<path d="M233 137q87-14 174 0M233 145q87-14 174 0M320 143v188M242 200l-27 70M398 200l27 70M275 338l-16 310M365 338l16 310"/>';
    if (back) details += '<path d="M240 202h50v74l-25 15-25-15zM350 202h50v74l-25 15-25-15z"/>';
    else details += '<path d="M325 148v118q-12 19-25 0M316 145v40M331 145v40"/>';
    if (product.type === "joggers") details += '<path d="M231 625h72v29h-75zM338 625h72l-1 29h-74z" fill-opacity=".1" fill="#16141b"/>';
    else details += '<path d="M209 668h91M340 668h91" stroke-width="3"/>';
  }
  if (product.type === "skirt") details += '<path d="M245 191q75-12 150 0M261 217l-31 421M372 216l27 417M210 312l42-55M169 644q151 32 302 0"/>';
  if (product.type === "bag") {
    details += '<path d="M242 310V211q0-111 78-111t78 111v99" fill="none" stroke-width="19"/><path d="M243 310V211q0-108 77-108t77 108v99" stroke-width="2" stroke="#fff" opacity=".22"/><path d="M190 316h259M189 625q131 33 262 0M235 349v242M405 349v242"/>';
    if (!back) details += `<text x="320" y="485" text-anchor="middle" fill="#ddfb79" stroke="none" font-family="Arial,sans-serif" font-size="30" font-weight="900" letter-spacing="-2">SDVIG ↗</text>`;
  }
  if (product.type === "beanie") {
    details += '<path d="M210 390q110 30 220 0M204 486q116 28 232 0M319 174v214"/>';
    if (!back) details += '<rect x="290" y="432" width="60" height="35" fill="#29242d" stroke="none"/><path d="M308 442h16v16h-5v-11h-11m-2 15 13-13" stroke="#ddfb79" stroke-width="3"/>';
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800" role="img"><title>${product.name} — ${color.name}${back ? ", вид сзади" : ""}</title><defs><linearGradient id="cloth" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#fff" stop-opacity=".2"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#16121d" stop-opacity=".23"/></linearGradient><pattern id="weave" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 1h4M1 0v4" stroke="#fff" stroke-width=".4" opacity=".13"/></pattern><pattern id="knit" width="8" height="12" patternUnits="userSpaceOnUse"><path d="M2 0v12M5 0v12" stroke="#fff" opacity=".17"/><path d="m1 2 3 4-3 4m6-8-3 4 3 4" fill="none" stroke="#17131d" stroke-width=".6" opacity=".13"/></pattern><filter id="shadow" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#211c29" flood-opacity=".16"/></filter><clipPath id="cut"><path d="${path}"/></clipPath></defs><g filter="url(#shadow)"><path d="${path}" fill="${color.hex}"/><g clip-path="url(#cut)"><path d="${path}" fill="url(#cloth)"/><path d="${path}" fill="url(#${fabric})"/><path d="M215 212Q276 375 234 617M420 194Q365 442 413 601" fill="none" stroke="#fff" stroke-width="18" opacity=".05"/></g><path d="${path}" fill="none" stroke="#231c2e" stroke-opacity=".3" stroke-width="1.5"/><g fill="none" stroke="#211b28" stroke-opacity=".35" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${details}</g></g></svg>`;
}

await Promise.all(PRODUCTS.flatMap((product) => product.variants.flatMap((variant) => [false, true].map((back) => writeFile(
  resolve(root, back ? variant.backImage : variant.image), drawing(product, variant, back), "utf8",
)))));
console.log(`Assets ready: ${PRODUCTS.length} original garments, ${PRODUCTS.reduce((n, p) => n + p.variants.length * 2, 0)} product illustrations, 2 campaign images, local fonts.`);
