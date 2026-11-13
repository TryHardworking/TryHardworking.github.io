import {
  COLORS,
  COUPONS,
  DELIVERY,
  FREE_DELIVERY_FROM,
  MAX_CART_LINES,
  MAX_QUANTITY,
  PRODUCTS,
  getProduct,
  getVariant,
} from "./catalog.js";

export const DEFAULT_FILTERS = Object.freeze({
  query: "",
  category: "all",
  sizes: Object.freeze([]),
  colors: Object.freeze([]),
  maxPrice: 16000,
  favoritesOnly: false,
  sort: "featured",
});

export const emptyState = () => ({
  cart: [],
  favorites: [],
  coupon: "",
  delivery: "point",
});

export const lineKey = ({ productId, color, size }) => `${productId}:${color}:${size}`;

export function lineStock(line) {
  const product = getProduct(line?.productId);
  const variant = getVariant(product, line?.color);
  return Number(variant?.stock?.[line?.size] || 0);
}

export function normalizeState(input) {
  const clean = emptyState();
  if (!input || typeof input !== "object") return clean;

  const seen = new Set();
  for (const candidate of Array.isArray(input.cart) ? input.cart : []) {
    if (!candidate || typeof candidate !== "object") continue;
    const line = {
      productId: String(candidate.productId || ""),
      color: String(candidate.color || ""),
      size: String(candidate.size || ""),
      quantity: Math.floor(Number(candidate.quantity)),
    };
    const key = lineKey(line);
    const stock = lineStock(line);
    if (!stock || seen.has(key) || clean.cart.length >= MAX_CART_LINES) continue;
    line.quantity = Math.max(1, Math.min(line.quantity || 1, stock, MAX_QUANTITY));
    clean.cart.push(line);
    seen.add(key);
  }

  clean.favorites = [...new Set(Array.isArray(input.favorites) ? input.favorites.map(String) : [])]
    .filter((id) => getProduct(id));
  const coupon = String(input.coupon || "").trim().toUpperCase();
  clean.coupon = COUPONS[coupon] ? coupon : "";
  clean.delivery = DELIVERY[input.delivery] ? input.delivery : "point";
  return clean;
}

export function addToCart(cart, selection, amount = 1) {
  const normalized = normalizeState({ cart }).cart;
  const product = getProduct(selection?.productId);
  const variant = getVariant(product, selection?.color);
  const stock = Number(variant?.stock?.[selection?.size] || 0);
  const quantity = Math.max(1, Math.floor(Number(amount) || 1));
  if (!product || !variant || !stock) return { cart: normalized, added: 0, reason: "unavailable" };

  const item = { productId: product.id, color: variant.color, size: selection.size };
  const key = lineKey(item);
  const index = normalized.findIndex((line) => lineKey(line) === key);
  if (index === -1 && normalized.length >= MAX_CART_LINES) return { cart: normalized, added: 0, reason: "limit" };

  const current = index < 0 ? 0 : normalized[index].quantity;
  const next = Math.min(current + quantity, stock, MAX_QUANTITY);
  if (next === current) return { cart: normalized, added: 0, reason: "stock" };
  if (index < 0) normalized.push({ ...item, quantity: next });
  else normalized[index] = { ...normalized[index], quantity: next };
  return { cart: normalized, added: next - current, reason: "" };
}

export function setCartQuantity(cart, key, quantity) {
  const normalized = normalizeState({ cart }).cart;
  const index = normalized.findIndex((line) => lineKey(line) === key);
  if (index < 0) return normalized;
  const next = Math.floor(Number(quantity));
  if (next <= 0) return normalized.filter((_, itemIndex) => itemIndex !== index);
  normalized[index] = {
    ...normalized[index],
    quantity: Math.min(next, lineStock(normalized[index]), MAX_QUANTITY),
  };
  return normalized;
}

export function getCartLines(cart) {
  return normalizeState({ cart }).cart.map((line) => {
    const product = getProduct(line.productId);
    const variant = getVariant(product, line.color);
    return {
      ...line,
      key: lineKey(line),
      product,
      variant,
      color: COLORS[line.color],
      lineTotal: product.price * line.quantity,
      stock: lineStock(line),
    };
  });
}

export function cartSummary(cart, deliveryId = "point", couponCode = "") {
  const lines = getCartLines(cart);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const coupon = String(couponCode || "").trim().toUpperCase();
  const discountRate = Number(COUPONS[coupon] || 0);
  const discount = Math.round(subtotal * discountRate / 100);
  const deliveryOption = DELIVERY[deliveryId] || DELIVERY.point;
  const delivery = subtotal >= FREE_DELIVERY_FROM ? 0 : deliveryOption.price;
  return {
    lines,
    subtotal,
    quantity,
    discount,
    discountRate,
    delivery,
    deliveryOption,
    total: Math.max(0, subtotal - discount + delivery),
    freeDeliveryRemaining: Math.max(0, FREE_DELIVERY_FROM - subtotal),
  };
}

export function filterProducts(filters = DEFAULT_FILTERS, favoriteIds = []) {
  const query = String(filters.query || "").trim().toLocaleLowerCase("ru");
  const sizes = Array.isArray(filters.sizes) ? filters.sizes : [];
  const colors = Array.isArray(filters.colors) ? filters.colors : [];
  const favorites = new Set(favoriteIds);
  const maxPrice = Number(filters.maxPrice) || DEFAULT_FILTERS.maxPrice;

  const result = PRODUCTS.filter((product) => {
    if (filters.category && filters.category !== "all" && product.category !== filters.category) return false;
    if (product.price > maxPrice) return false;
    if (filters.favoritesOnly && !favorites.has(product.id)) return false;
    if (query && !`${product.name} ${product.short} ${product.tag} ${product.fit}`.toLocaleLowerCase("ru").includes(query)) return false;
    if (sizes.length && !sizes.some((size) => product.variants.some((variant) => Number(variant.stock[size]) > 0))) return false;
    if (colors.length && !colors.some((color) => product.variants.some((variant) => variant.color === color))) return false;
    return true;
  });

  return result.sort((a, b) => {
    if (filters.sort === "price-asc") return a.price - b.price || a.rank - b.rank;
    if (filters.sort === "price-desc") return b.price - a.price || a.rank - b.rank;
    if (filters.sort === "new") return Number(b.isNew) - Number(a.isNew) || a.rank - b.rank;
    return a.rank - b.rank;
  });
}

export function toggleFavorite(favorites, productId) {
  if (!getProduct(productId)) return [...favorites];
  const set = new Set(favorites);
  if (set.has(productId)) set.delete(productId); else set.add(productId);
  return [...set];
}

export function validateOrder(values, deliveryId) {
  const errors = {};
  const name = String(values.name || "").trim();
  const email = String(values.email || "").trim();
  const phone = String(values.phone || "").replace(/\D/g, "");
  const address = String(values.address || "").trim();
  if (name.length < 2) errors.name = "Укажите имя — минимум 2 символа";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Проверьте адрес электронной почты";
  if (phone.length < 10 || phone.length > 15) errors.phone = "Укажите телефон: от 10 до 15 цифр";
  const option = DELIVERY[deliveryId] || DELIVERY.point;
  if (option.needsAddress && address.length < 6) errors.address = "Укажите город и полный адрес";
  if (!values.consent) errors.consent = "Нужно подтвердить согласие для демонстрации";
  return errors;
}
