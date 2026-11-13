import {
  CATEGORIES,
  COLORS,
  COUPONS,
  DELIVERY,
  FREE_DELIVERY_FROM,
  LOOKS,
  PRODUCTS,
  STORAGE_KEY,
  getProduct,
  getVariant,
  money,
  sizeLabel,
} from "./catalog.js";
import {
  DEFAULT_FILTERS,
  addToCart,
  cartSummary,
  emptyState,
  filterProducts,
  lineKey,
  normalizeState,
  setCartQuantity,
  toggleFavorite,
  validateOrder,
} from "./store.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const dialogs = {
  menu: $("#menu-dialog"),
  product: $("#product-dialog"),
  cart: $("#cart-dialog"),
  checkout: $("#checkout-dialog"),
  success: $("#success-dialog"),
};

let state = loadState();
let filters = { ...DEFAULT_FILTERS, sizes: [], colors: [] };
let activeLook = 0;
let productSelection = null;
let toastTimer = 0;
let storageWarningShown = false;
const cardColors = new Map();
const lookSizes = new Map();
const dialogOpeners = new WeakMap();
const skipFocusRestore = new WeakSet();

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return emptyState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      showToast("Браузер не разрешил сохранение. Корзина продолжит работать до закрытия вкладки.");
    }
  }
}

function showToast(message) {
  const toast = $("[data-toast]");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function syncDialogState() {
  document.body.classList.toggle("dialog-open", $$('dialog[open]').length > 0);
}

function openDialog(dialog, opener = document.activeElement) {
  if (!dialog) return;
  $$('dialog[open]').forEach((current) => {
    if (current !== dialog) closeDialog(current, false);
  });
  if (opener instanceof HTMLElement) dialogOpeners.set(dialog, opener);
  if (!dialog.open) dialog.showModal();
  syncDialogState();
}

function closeDialog(dialog, restoreFocus = true) {
  if (!dialog?.open) return;
  if (!restoreFocus) skipFocusRestore.add(dialog);
  dialog.close();
}

Object.values(dialogs).forEach((dialog) => {
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', dialog)
      .filter((element) => element.getClientRects().length && element.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
  dialog.addEventListener("close", () => {
    syncDialogState();
    if (skipFocusRestore.has(dialog)) {
      skipFocusRestore.delete(dialog);
      return;
    }
    const opener = dialogOpeners.get(dialog);
    if (opener?.isConnected) requestAnimationFrame(() => opener.focus({ preventScroll: true }));
  });
});

function availableSizes(product, variant) {
  return product.sizes.filter((size) => Number(variant.stock[size]) > 0);
}

function defaultSize(product, variant) {
  const sizes = availableSizes(product, variant);
  return sizes.includes("M") ? "M" : sizes[0];
}

function pluralThings(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "вещь";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "вещи";
  return "вещей";
}

function renderCategories() {
  $("[data-categories]").innerHTML = CATEGORIES.map((category) => `
    <button type="button" data-category="${category.id}" aria-pressed="${filters.category === category.id}">${category.name}</button>
  `).join("");
}

function renderFilterControls() {
  const sizes = ["XS", "S", "M", "L", "XL", "ONE"];
  $("[data-size-filters]").innerHTML = sizes.map((size) => `
    <label><input type="checkbox" value="${size}" data-size-filter><span>${sizeLabel(size)}</span></label>
  `).join("");
  $("[data-color-filters]").innerHTML = Object.entries(COLORS).map(([id, color]) => `
    <label title="${color.name}"><input type="checkbox" value="${id}" data-color-filter aria-label="${color.name}"><span style="--swatch:${color.hex}"></span></label>
  `).join("");
}

function activeFilterCount() {
  return filters.sizes.length + filters.colors.length + Number(filters.maxPrice < DEFAULT_FILTERS.maxPrice) +
    Number(filters.favoritesOnly) + Number(Boolean(filters.query));
}

function syncFilterControls() {
  $$('[data-category]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.category === filters.category)));
  $$('[data-size-filter]').forEach((input) => { input.checked = filters.sizes.includes(input.value); });
  $$('[data-color-filter]').forEach((input) => { input.checked = filters.colors.includes(input.value); });
  $("[data-search]").value = filters.query;
  $("[data-price]").value = String(filters.maxPrice);
  $("[data-price-output]").textContent = money(filters.maxPrice);
  $("[data-favorites-only]").checked = filters.favoritesOnly;
  $("[data-sort]").value = filters.sort;
  const count = activeFilterCount();
  const badge = $("[data-filter-count]");
  badge.textContent = String(count);
  badge.hidden = count === 0;
  $("[data-active-reset]").hidden = count === 0 && filters.category === "all";
}

function productCard(product) {
  const selectedColor = cardColors.get(product.id) || product.variants[0].color;
  const variant = getVariant(product, selectedColor) || product.variants[0];
  cardColors.set(product.id, variant.color);
  const favorite = state.favorites.includes(product.id);
  return `
    <article class="product-card" data-card="${product.id}">
      <div class="product-card__visual">
        <button class="product-card__open" type="button" data-open-product="${product.id}" data-product-color="${variant.color}" aria-label="Открыть ${product.name}">
          <img src="${variant.image}" width="640" height="800" alt="${product.name}, цвет ${COLORS[variant.color].name}" loading="lazy">
        </button>
        ${product.isNew ? '<span class="product-card__badge">NEW</span>' : ""}
        <button class="favorite-button" type="button" data-favorite="${product.id}" aria-pressed="${favorite}" aria-label="${favorite ? "Убрать из избранного" : "Добавить в избранное"}: ${product.name}"><span aria-hidden="true">${favorite ? "♥" : "♡"}</span></button>
        <button class="quick-view" type="button" data-open-product="${product.id}" data-product-color="${variant.color}"><span>Подробнее</span><b aria-hidden="true">↗</b></button>
      </div>
      <div class="product-card__info">
        <div class="product-card__name-row"><h3>${product.name}</h3><p class="product-card__price">${money(product.price)}</p></div>
        <p class="product-card__meta">${product.fit}</p>
        <div class="card-swatches" role="group" aria-label="Цвета: ${product.name}">${product.variants.map((item) => `
          <button type="button" data-card-color="${item.color}" aria-pressed="${item.color === variant.color}" aria-label="${COLORS[item.color].name}" style="--swatch:${COLORS[item.color].hex}"></button>
        `).join("")}</div>
      </div>
    </article>
  `;
}

function renderProducts() {
  const products = filterProducts(filters, state.favorites);
  $("[data-product-grid]").innerHTML = products.map(productCard).join("");
  $("[data-product-grid]").hidden = products.length === 0;
  $("[data-catalog-empty]").hidden = products.length > 0;
  $("[data-result-count]").textContent = `Найдено ${products.length} ${pluralThings(products.length)}`;
  syncFilterControls();
}

function resetFilters() {
  filters = { ...DEFAULT_FILTERS, sizes: [], colors: [] };
  renderProducts();
}

function setFilterPanel(open) {
  const panel = $("[data-filter-panel]");
  const toggle = $("[data-filter-toggle]");
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
}

function showFavorites() {
  closeDialog(dialogs.menu, false);
  filters.favoritesOnly = true;
  setFilterPanel(true);
  renderProducts();
  $("#catalog").scrollIntoView({ behavior: "smooth", block: "start" });
  if (!state.favorites.length) showToast("Избранное пока пусто — отметь вещи сердцем.");
}

function openSearch() {
  setFilterPanel(true);
  $("#catalog").scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => $("[data-search]").focus(), 350);
}

function renderProductDialog() {
  if (!productSelection) return;
  const product = getProduct(productSelection.productId);
  const variant = getVariant(product, productSelection.color) || product.variants[0];
  if (!variant.stock[productSelection.size]) productSelection.size = defaultSize(product, variant);
  const color = COLORS[variant.color];
  const image = productSelection.view === "back" ? variant.backImage : variant.image;
  const inCart = state.cart.find((line) => lineKey(line) === lineKey({ productId: product.id, color: variant.color, size: productSelection.size }))?.quantity || 0;
  const stock = Number(variant.stock[productSelection.size] || 0);
  const remaining = Math.max(0, stock - inCart);
  const favorite = state.favorites.includes(product.id);

  $("[data-product-image]").src = image;
  $("[data-product-image]").alt = `${product.name}, ${color.name}, вид ${productSelection.view === "back" ? "сзади" : "спереди"}`;
  $(".product-dialog__media").style.background = color.hex;
  $("[data-product-code]").textContent = `S / ${String(product.rank).padStart(3, "0")}`;
  $("[data-product-tag]").textContent = product.tag;
  $("[data-product-name]").textContent = product.name;
  $("[data-product-price]").textContent = money(product.price);
  $("[data-product-description]").textContent = product.description;
  $("[data-color-name]").textContent = color.name;
  $("[data-composition]").textContent = product.composition;
  $("[data-care]").textContent = product.care;
  $("[data-product-add-price]").textContent = money(product.price);
  $("[data-product-favorite]").setAttribute("aria-pressed", String(favorite));
  $("[data-product-favorite]").setAttribute("aria-label", `${favorite ? "Убрать из избранного" : "Добавить в избранное"}: ${product.name}`);
  $("[data-product-favorite] span").textContent = favorite ? "♥" : "♡";

  $("[data-product-colors]").innerHTML = product.variants.map((item) => `
    <button type="button" data-product-select-color="${item.color}" aria-pressed="${item.color === variant.color}" aria-label="${COLORS[item.color].name}" style="--swatch:${COLORS[item.color].hex}"></button>
  `).join("");
  $("[data-product-sizes]").innerHTML = product.sizes.map((size) => `
    <button type="button" data-product-select-size="${size}" aria-pressed="${size === productSelection.size}" ${variant.stock[size] ? "" : "disabled"}>${sizeLabel(size)}</button>
  `).join("");
  $$('[data-view]', dialogs.product).forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === productSelection.view)));

  const stockNote = $("[data-stock-note]");
  if (!remaining) stockNote.textContent = "Весь доступный остаток уже в корзине";
  else if (remaining <= 2) stockNote.textContent = `Осталось ${remaining} шт.`;
  else stockNote.textContent = "В наличии";
  $("[data-product-add]").disabled = remaining === 0;

  const accessory = product.category === "accessories";
  $("[data-measurements]").innerHTML = `<table class="measurement-table">
    <thead><tr><th>Размер</th><th>${accessory ? "Ширина" : "Обхват"}, см</th><th>${accessory ? "Высота" : "Длина"}, см</th></tr></thead>
    <tbody>${Object.entries(product.measurements).map(([size, values]) => `<tr><td>${sizeLabel(size)}</td><td>${values[0]}</td><td>${values[1]}</td></tr>`).join("")}</tbody>
  </table>`;
}

function openProduct(productId, color) {
  const product = getProduct(productId);
  if (!product) return;
  const variant = getVariant(product, color) || product.variants[0];
  productSelection = { productId, color: variant.color, size: defaultSize(product, variant), view: "front" };
  renderProductDialog();
  openDialog(dialogs.product);
}

function addCurrentProduct() {
  if (!productSelection) return;
  const result = addToCart(state.cart, productSelection, 1);
  if (!result.added) {
    showToast(result.reason === "stock" ? "Доступный остаток уже в корзине." : "Этого варианта сейчас нет.");
    return;
  }
  state.cart = result.cart;
  saveState();
  renderState();
  renderProductDialog();
  const product = getProduct(productSelection.productId);
  showToast(`${product.short} · ${productSelection.size} — добавлено в корзину.`);
}

function renderLookTabs() {
  $("[data-look-tabs]").innerHTML = LOOKS.map((look, index) => `
    <button type="button" role="tab" id="look-tab-${look.id}" aria-controls="look-panel-${look.id}" aria-selected="${index === activeLook}" tabindex="${index === activeLook ? 0 : -1}" data-look-index="${index}"><span>${look.number}</span>${look.name}</button>
  `).join("");
}

function lookSizeKey(look, item) {
  return `${look.id}:${item.productId}:${item.color}`;
}

function getLookSize(look, item) {
  const product = getProduct(item.productId);
  const variant = getVariant(product, item.color);
  const key = lookSizeKey(look, item);
  const current = lookSizes.get(key);
  if (current && variant.stock[current]) return current;
  const size = defaultSize(product, variant);
  lookSizes.set(key, size);
  return size;
}

function renderLook() {
  renderLookTabs();
  const look = LOOKS[activeLook];
  const products = look.items.map((item) => ({ item, product: getProduct(item.productId), variant: getVariant(getProduct(item.productId), item.color) }));
  const palette = ["#b7a5c6", "#c7ceaa", "#d6b6ab"];
  $("[data-look-builder]").innerHTML = `
    <div class="look-stage" style="--look-color:${palette[activeLook]}" role="tabpanel" id="look-panel-${look.id}" aria-labelledby="look-tab-${look.id}">
      <span class="look-stage__number" aria-hidden="true">${look.number}</span>
      <div class="look-stage__items">${products.map(({ product, variant }) => `<img src="${variant.image}" width="640" height="800" alt="${product.name}, ${COLORS[variant.color].name}">`).join("")}</div>
      <div class="look-stage__caption"><p>${look.subtitle}</p><span>${look.note}</span></div>
    </div>
    <div class="look-panel">
      <p>Образ ${look.number} / ${products.length} вещи</p>
      <h3>${look.name}</h3>
      <div class="look-panel__items">${products.map(({ item, product, variant }) => {
        const selected = getLookSize(look, item);
        return `<div class="look-item">
          <img src="${variant.image}" width="640" height="800" alt="" loading="lazy">
          <div><a href="#catalog" data-open-product="${product.id}" data-product-color="${variant.color}">${product.name}</a><p>${COLORS[variant.color].name} · ${money(product.price)}</p></div>
          <label><span class="sr-only">Размер: ${product.name}</span><select data-look-size="${lookSizeKey(look, item)}">${availableSizes(product, variant).map((size) => `<option value="${size}" ${size === selected ? "selected" : ""}>${sizeLabel(size)}</option>`).join("")}</select></label>
        </div>`;
      }).join("")}</div>
      <p class="look-panel__total"><span>За весь образ</span><strong>${money(products.reduce((sum, { product }) => sum + product.price, 0))}</strong></p>
      <button class="add-button" type="button" data-add-look><span>Добавить образ в корзину</span><b>＋</b></button>
    </div>
  `;
}

function addLookToCart() {
  const look = LOOKS[activeLook];
  let nextCart = state.cart;
  for (const item of look.items) {
    const result = addToCart(nextCart, { ...item, size: getLookSize(look, item) }, 1);
    if (!result.added) {
      showToast("Не удалось добавить весь образ: один из вариантов уже закончился или достигнут лимит.");
      return;
    }
    nextCart = result.cart;
  }
  state.cart = nextCart;
  saveState();
  renderState();
  showToast(`Образ «${look.name}» целиком добавлен в корзину.`);
}

function renderHeaderCounts() {
  const summary = cartSummary(state.cart, state.delivery, state.coupon);
  $$('[data-cart-count]').forEach((node) => {
    node.textContent = String(summary.quantity);
    if (node.classList.contains("header-count")) node.hidden = summary.quantity === 0;
  });
  $$('[data-favorites-count]').forEach((node) => {
    node.textContent = String(state.favorites.length);
    if (node.classList.contains("header-count")) node.hidden = state.favorites.length === 0;
  });
  $(".site-header [data-cart-open]").setAttribute("aria-label", `Открыть корзину, товаров: ${summary.quantity}`);
}

function renderDeliveryOptions() {
  $("[data-delivery-options]").innerHTML = Object.entries(DELIVERY).map(([id, option]) => `
    <label><input type="radio" name="cart-delivery" value="${id}" ${state.delivery === id ? "checked" : ""}><span>${option.name}</span></label>
  `).join("");
}

function renderCart() {
  const summary = cartSummary(state.cart, state.delivery, state.coupon);
  $("[data-cart-title-count]").textContent = String(summary.quantity);
  $("[data-cart-lines]").innerHTML = summary.lines.map((line) => `
    <article class="cart-line" data-cart-key="${line.key}">
      <img src="${line.variant.image}" width="640" height="800" alt="${line.product.name}, ${line.color.name}">
      <div class="cart-line__main">
        <a href="#catalog" data-open-product="${line.product.id}" data-product-color="${line.variant.color}">${line.product.name}</a>
        <p>${line.color.name} · ${sizeLabel(line.size)}</p>
        <div class="quantity" aria-label="Количество: ${line.product.name}"><button type="button" data-cart-change="-1" aria-label="Уменьшить количество">−</button><output>${line.quantity}</output><button type="button" data-cart-change="1" aria-label="Увеличить количество" ${line.quantity >= line.stock ? "disabled" : ""}>＋</button></div>
      </div>
      <div class="cart-line__end"><strong>${money(line.lineTotal)}</strong><button type="button" data-cart-remove>Удалить</button></div>
    </article>
  `).join("");
  const empty = summary.lines.length === 0;
  $("[data-cart-lines]").hidden = empty;
  $("[data-cart-empty]").hidden = !empty;
  $("[data-cart-footer]").hidden = empty;
  $("[data-shipping-progress]").hidden = empty;
  if (!empty) {
    $("[data-shipping-message]").textContent = summary.freeDeliveryRemaining ? `До бесплатной доставки осталось ${money(summary.freeDeliveryRemaining)}` : "Бесплатная доставка разблокирована";
    $("[data-shipping-bar]").style.width = `${Math.min(100, summary.subtotal / FREE_DELIVERY_FROM * 100)}%`;
    renderDeliveryOptions();
    $("[data-subtotal]").textContent = money(summary.subtotal);
    $("[data-discount-row]").hidden = !summary.discount;
    $("[data-discount]").textContent = `− ${money(summary.discount)}`;
    $("[data-delivery-price]").textContent = summary.delivery ? money(summary.delivery) : "Бесплатно";
    $("[data-total]").textContent = money(summary.total);
    $("[data-coupon-form] input").value = state.coupon;
    $("[data-coupon-status]").textContent = state.coupon ? `Промокод применён: скидка ${summary.discountRate}%` : "Подсказка для проверки: SDVIG10";
  }
}

function renderState({ products = false } = {}) {
  renderHeaderCounts();
  renderCart();
  if (products || filters.favoritesOnly) renderProducts();
}

function changeCartLine(key, delta) {
  const line = state.cart.find((item) => lineKey(item) === key);
  if (!line) return;
  state.cart = setCartQuantity(state.cart, key, line.quantity + delta);
  saveState();
  renderState();
}

function openCart() {
  closeDialog(dialogs.menu, false);
  renderCart();
  openDialog(dialogs.cart);
}

function renderCheckout() {
  const summary = cartSummary(state.cart, state.delivery, state.coupon);
  $("[data-checkout-lines]").innerHTML = summary.lines.map((line) => `
    <div class="checkout-summary-line"><img src="${line.variant.image}" width="640" height="800" alt=""><p><strong>${line.product.name}</strong><span>${line.color.name} · ${sizeLabel(line.size)} · ${line.quantity} шт.</span></p><b>${money(line.lineTotal)}</b></div>
  `).join("");
  $("[data-checkout-delivery]").textContent = `${summary.deliveryOption.name}${summary.delivery ? ` · ${money(summary.delivery)}` : " · бесплатно"}`;
  $("[data-checkout-summary-total]").textContent = money(summary.total);
  $("[data-checkout-total]").textContent = money(summary.total);
  const addressField = $("[data-address-field]");
  const address = $("[name=address]", addressField);
  addressField.hidden = !summary.deliveryOption.needsAddress;
  address.required = summary.deliveryOption.needsAddress;
  address.placeholder = summary.deliveryOption.placeholder;
}

function openCheckout() {
  if (!state.cart.length) return;
  renderCheckout();
  closeDialog(dialogs.cart, false);
  openDialog(dialogs.checkout, $(".site-header [data-cart-open]"));
  requestAnimationFrame(() => $("[name=name]", dialogs.checkout).focus());
}

function clearCheckoutErrors() {
  $$('[data-error-for]', dialogs.checkout).forEach((node) => { node.textContent = ""; });
  $$('[aria-invalid="true"]', dialogs.checkout).forEach((node) => node.removeAttribute("aria-invalid"));
}

function submitCheckout(form) {
  clearCheckoutErrors();
  const values = Object.fromEntries(new FormData(form));
  values.consent = form.elements.consent.checked;
  const errors = validateOrder(values, state.delivery);
  if (Object.keys(errors).length) {
    for (const [name, message] of Object.entries(errors)) {
      $(`[data-error-for="${name}"]`, form).textContent = message;
      if (form.elements[name]) form.elements[name].setAttribute("aria-invalid", "true");
    }
    form.elements[Object.keys(errors)[0]]?.focus();
    return;
  }

  const summary = cartSummary(state.cart, state.delivery, state.coupon);
  const random = globalThis.crypto?.getRandomValues ? crypto.getRandomValues(new Uint16Array(1))[0] : Date.now() % 65536;
  $("[data-order-number]").textContent = `SDV-26-${random.toString(16).toUpperCase().padStart(4, "0")}`;
  $("[data-order-total]").textContent = money(summary.total);
  state.cart = [];
  state.coupon = "";
  saveState();
  form.reset();
  clearCheckoutErrors();
  renderState();
  closeDialog(dialogs.checkout, false);
  openDialog(dialogs.success, $(".site-header [data-cart-open]"));
}

function toggleProductFavorite(productId) {
  const wasFavorite = state.favorites.includes(productId);
  state.favorites = toggleFavorite(state.favorites, productId);
  saveState();
  renderState({ products: true });
  if (productSelection?.productId === productId) renderProductDialog();
  showToast(wasFavorite ? "Убрано из избранного." : "Сохранено в избранном.");
}

renderCategories();
renderFilterControls();
renderProducts();
renderLook();
renderState();

$("[data-categories]").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  filters.category = button.dataset.category;
  renderProducts();
});

$("[data-filter-toggle]").addEventListener("click", () => setFilterPanel($("[data-filter-panel]").hidden));
$("[data-sort]").addEventListener("change", (event) => { filters.sort = event.target.value; renderProducts(); });
$("[data-filter-panel]").addEventListener("input", (event) => {
  if (event.target.matches("[data-search]")) filters.query = event.target.value;
  if (event.target.matches("[data-price]")) filters.maxPrice = Number(event.target.value);
  if (event.target.matches("[data-favorites-only]")) filters.favoritesOnly = event.target.checked;
  if (event.target.matches("[data-size-filter]")) filters.sizes = $$('[data-size-filter]:checked').map((input) => input.value);
  if (event.target.matches("[data-color-filter]")) filters.colors = $$('[data-color-filter]:checked').map((input) => input.value);
  renderProducts();
});
$("[data-search-clear]").addEventListener("click", () => { filters.query = ""; renderProducts(); $("[data-search]").focus(); });
$$('[data-filter-reset], [data-active-reset], [data-empty-reset]').forEach((button) => button.addEventListener("click", resetFilters));
$$('[data-search-open]').forEach((button) => button.addEventListener("click", openSearch));
$$('[data-favorites-open]').forEach((button) => button.addEventListener("click", showFavorites));
$$('[data-cart-open]').forEach((button) => button.addEventListener("click", openCart));

$("[data-product-grid]").addEventListener("click", (event) => {
  const favorite = event.target.closest("[data-favorite]");
  if (favorite) return toggleProductFavorite(favorite.dataset.favorite);
  const swatch = event.target.closest("[data-card-color]");
  if (swatch) {
    const card = swatch.closest("[data-card]");
    const product = getProduct(card.dataset.card);
    const variant = getVariant(product, swatch.dataset.cardColor);
    cardColors.set(product.id, variant.color);
    $("img", card).src = variant.image;
    $("img", card).alt = `${product.name}, цвет ${COLORS[variant.color].name}`;
    $$('[data-card-color]', card).forEach((button) => button.setAttribute("aria-pressed", String(button === swatch)));
    $$('[data-open-product]', card).forEach((button) => button.dataset.productColor = variant.color);
    return;
  }
  const opener = event.target.closest("[data-open-product]");
  if (opener) openProduct(opener.dataset.openProduct, opener.dataset.productColor);
});

document.addEventListener("click", (event) => {
  const close = event.target.closest("[data-dialog-close]");
  if (close) closeDialog(close.closest("dialog"));
  const opener = event.target.closest("[data-open-product]");
  if (opener && !opener.closest("[data-product-grid]")) {
    event.preventDefault();
    openProduct(opener.dataset.openProduct, opener.dataset.productColor);
  }
});

$("[data-menu-open]").addEventListener("click", () => openDialog(dialogs.menu));
$$('a[href^="#"]', dialogs.menu).forEach((link) => link.addEventListener("click", () => closeDialog(dialogs.menu, false)));

dialogs.product.addEventListener("click", (event) => {
  const color = event.target.closest("[data-product-select-color]");
  if (color) {
    productSelection.color = color.dataset.productSelectColor;
    productSelection.view = "front";
    const product = getProduct(productSelection.productId);
    productSelection.size = defaultSize(product, getVariant(product, productSelection.color));
    renderProductDialog();
  }
  const size = event.target.closest("[data-product-select-size]");
  if (size) { productSelection.size = size.dataset.productSelectSize; renderProductDialog(); }
  const view = event.target.closest("[data-view]");
  if (view) { productSelection.view = view.dataset.view; renderProductDialog(); }
  if (event.target.closest("[data-product-add]")) addCurrentProduct();
  if (event.target.closest("[data-product-favorite]")) toggleProductFavorite(productSelection.productId);
  if (event.target.closest("[data-size-help]")) {
    const details = $(".product-details details", dialogs.product);
    details.open = true;
    details.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
});

$("[data-look-tabs]").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-look-index]");
  if (!tab) return;
  activeLook = Number(tab.dataset.lookIndex);
  renderLook();
});
$("[data-look-tabs]").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "Home") activeLook = 0;
  else if (event.key === "End") activeLook = LOOKS.length - 1;
  else activeLook = (activeLook + (event.key === "ArrowRight" ? 1 : -1) + LOOKS.length) % LOOKS.length;
  renderLook();
  $(`[data-look-index="${activeLook}"]`).focus();
});
$("[data-look-builder]").addEventListener("change", (event) => {
  if (event.target.matches("[data-look-size]")) lookSizes.set(event.target.dataset.lookSize, event.target.value);
});
$("[data-look-builder]").addEventListener("click", (event) => {
  if (event.target.closest("[data-add-look]")) addLookToCart();
});

dialogs.cart.addEventListener("click", (event) => {
  const line = event.target.closest("[data-cart-key]");
  if (line && event.target.closest("[data-cart-change]")) changeCartLine(line.dataset.cartKey, Number(event.target.closest("[data-cart-change]").dataset.cartChange));
  if (line && event.target.closest("[data-cart-remove]")) {
    state.cart = setCartQuantity(state.cart, line.dataset.cartKey, 0);
    saveState();
    renderState();
    showToast("Вещь удалена из корзины.");
  }
  if (event.target.closest("[data-cart-catalog]")) {
    closeDialog(dialogs.cart, false);
    $("#catalog").scrollIntoView({ behavior: "smooth" });
  }
  if (event.target.closest("[data-checkout-open]")) openCheckout();
});
$("[data-delivery-options]").addEventListener("change", (event) => {
  if (!event.target.matches('[name="cart-delivery"]')) return;
  state.delivery = event.target.value;
  saveState();
  renderState();
});
$("[data-coupon-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  const code = String(new FormData(event.currentTarget).get("coupon") || "").trim().toUpperCase();
  if (!code) {
    state.coupon = "";
    saveState();
    renderCart();
    return;
  }
  if (!COUPONS[code]) {
    $("[data-coupon-status]").textContent = "Промокод не найден. Для демо попробуй SDVIG10.";
    return;
  }
  state.coupon = code;
  saveState();
  renderCart();
});

$("[data-checkout-back]").addEventListener("click", () => {
  closeDialog(dialogs.checkout, false);
  openCart();
});
$("[data-checkout-form]").addEventListener("input", (event) => {
  const name = event.target.name;
  if (!name) return;
  event.target.removeAttribute("aria-invalid");
  $(`[data-error-for="${name}"]`, dialogs.checkout)?.replaceChildren();
});
$("[data-checkout-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  submitCheckout(event.currentTarget);
});
$("[data-success-close]").addEventListener("click", () => closeDialog(dialogs.success));

$("[data-subscribe-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.email;
  const status = $("[data-subscribe-status]");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
    status.textContent = "Проверь адрес — похоже, в нём опечатка.";
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }
  input.removeAttribute("aria-invalid");
  input.value = "";
  status.textContent = "Готово — в демоверсии адрес никуда не отправлен и не сохранён.";
});

$("[data-year]").textContent = String(new Date().getFullYear());
const header = $("[data-header]");
const updateHeader = () => header.classList.toggle("is-scrolled", scrollY > 20);
addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

const reveals = $$('[data-reveal]');
if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
  reveals.forEach((element) => element.classList.add("is-visible"));
} else {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-visible");
    observer.unobserve(entry.target);
  }), { threshold: .08, rootMargin: "0px 0px -35px" });
  reveals.forEach((element) => observer.observe(element));
}
