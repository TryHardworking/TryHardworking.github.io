import test from "node:test";
import assert from "node:assert/strict";
import { COLORS, FREE_DELIVERY_FROM, PRODUCTS, getProduct } from "../js/catalog.js";
import {
  DEFAULT_FILTERS,
  addToCart,
  cartSummary,
  filterProducts,
  lineKey,
  normalizeState,
  setCartQuantity,
  toggleFavorite,
  validateOrder,
} from "../js/store.js";

test("catalog has unique, internally valid products and variants", () => {
  assert.equal(PRODUCTS.length, 12);
  assert.equal(new Set(PRODUCTS.map((product) => product.id)).size, PRODUCTS.length);
  for (const product of PRODUCTS) {
    assert.ok(product.price > 0);
    assert.ok(product.sizes.length > 0);
    assert.ok(product.variants.length > 0);
    for (const variant of product.variants) {
      assert.ok(COLORS[variant.color]);
      assert.match(variant.image, new RegExp(`/${product.id}-${variant.color}\\.svg$`));
      assert.ok(product.sizes.some((size) => variant.stock[size] > 0));
    }
  }
});

test("normalizeState rejects unknown and duplicate cart lines", () => {
  const input = {
    cart: [
      { productId: "pause", color: "chalk", size: "M", quantity: 2 },
      { productId: "pause", color: "chalk", size: "M", quantity: 4 },
      { productId: "missing", color: "chalk", size: "M", quantity: 3 },
      { productId: "pause", color: "nope", size: "M", quantity: 1 },
    ],
    favorites: ["pause", "pause", "missing"],
    coupon: "sdvig10",
    delivery: "bad",
  };
  const state = normalizeState(input);
  assert.deepEqual(state.cart, [{ productId: "pause", color: "chalk", size: "M", quantity: 2 }]);
  assert.deepEqual(state.favorites, ["pause"]);
  assert.equal(state.coupon, "SDVIG10");
  assert.equal(state.delivery, "point");
});

test("normalizeState caps quantity to stock and global per-line maximum", () => {
  const state = normalizeState({ cart: [{ productId: "pause", color: "chalk", size: "XL", quantity: 100 }] });
  assert.equal(state.cart[0].quantity, 2);
});

test("addToCart adds and merges the same variant", () => {
  const selection = { productId: "pause", color: "chalk", size: "M" };
  const first = addToCart([], selection, 2);
  const second = addToCart(first.cart, selection, 2);
  assert.equal(first.added, 2);
  assert.equal(second.cart.length, 1);
  assert.equal(second.cart[0].quantity, 4);
});

test("addToCart caps at stock and reports a full line", () => {
  const selection = { productId: "pause", color: "chalk", size: "XL" };
  const first = addToCart([], selection, 10);
  const second = addToCart(first.cart, selection, 1);
  assert.equal(first.cart[0].quantity, 2);
  assert.equal(second.added, 0);
  assert.equal(second.reason, "stock");
});

test("addToCart rejects unknown or sold-out variants", () => {
  assert.equal(addToCart([], { productId: "no", color: "chalk", size: "M" }).reason, "unavailable");
  assert.equal(addToCart([], { productId: "pause", color: "ink", size: "XL" }).reason, "unavailable");
});

test("setCartQuantity changes and removes a line", () => {
  const line = { productId: "orbit", color: "ink", size: "M", quantity: 1 };
  const key = lineKey(line);
  assert.equal(setCartQuantity([line], key, 3)[0].quantity, 3);
  assert.deepEqual(setCartQuantity([line], key, 0), []);
});

test("cartSummary calculates line totals, coupon and delivery", () => {
  const cart = [
    { productId: "pause", color: "chalk", size: "M", quantity: 1 },
    { productId: "orbit", color: "ink", size: "M", quantity: 1 },
  ];
  const summary = cartSummary(cart, "point", "SDVIG10");
  assert.equal(summary.subtotal, 10800);
  assert.equal(summary.discount, 1080);
  assert.equal(summary.delivery, 350);
  assert.equal(summary.total, 10070);
  assert.equal(summary.quantity, 2);
});

test("delivery becomes free at threshold and pickup is zero below it", () => {
  const expensive = [{ productId: "route", color: "stone", size: "M", quantity: 1 }];
  const cheap = [{ productId: "point", color: "chalk", size: "M", quantity: 1 }];
  assert.ok(getProduct("route").price >= FREE_DELIVERY_FROM);
  assert.equal(cartSummary(expensive, "courier").delivery, 0);
  assert.equal(cartSummary(cheap, "pickup").delivery, 0);
});

test("filterProducts filters by category, size, color, query and price", () => {
  assert.ok(filterProducts({ ...DEFAULT_FILTERS, category: "outerwear" }).every((product) => product.category === "outerwear"));
  assert.ok(filterProducts({ ...DEFAULT_FILTERS, sizes: ["XL"] }).every((product) => product.variants.some((variant) => variant.stock.XL > 0)));
  assert.ok(filterProducts({ ...DEFAULT_FILTERS, colors: ["rust"] }).every((product) => product.variants.some((variant) => variant.color === "rust")));
  assert.deepEqual(filterProducts({ ...DEFAULT_FILTERS, query: "ОрБиТа" }).map((product) => product.id), ["orbit"]);
  assert.ok(filterProducts({ ...DEFAULT_FILTERS, maxPrice: 3000 }).every((product) => product.price <= 3000));
});

test("filterProducts supports favorites and each sort order", () => {
  assert.deepEqual(filterProducts({ ...DEFAULT_FILTERS, favoritesOnly: true }, ["line", "pause"]).map((product) => product.id), ["pause", "line"]);
  const ascending = filterProducts({ ...DEFAULT_FILTERS, sort: "price-asc" });
  const descending = filterProducts({ ...DEFAULT_FILTERS, sort: "price-desc" });
  assert.equal(ascending[0].price, Math.min(...PRODUCTS.map((product) => product.price)));
  assert.equal(descending[0].price, Math.max(...PRODUCTS.map((product) => product.price)));
  const newest = filterProducts({ ...DEFAULT_FILTERS, sort: "new" });
  assert.ok(newest.slice(0, PRODUCTS.filter((product) => product.isNew).length).every((product) => product.isNew));
});

test("toggleFavorite is stable for valid and invalid ids", () => {
  assert.deepEqual(toggleFavorite([], "pause"), ["pause"]);
  assert.deepEqual(toggleFavorite(["pause"], "pause"), []);
  assert.deepEqual(toggleFavorite(["pause"], "missing"), ["pause"]);
});

test("validateOrder accepts a complete point-delivery order", () => {
  assert.deepEqual(validateOrder({ name: "Ира", email: "ira@example.ru", phone: "+7 999 123-45-67", address: "Киров, Ленина, 1", consent: true }, "point"), {});
});

test("validateOrder reports all invalid fields", () => {
  const errors = validateOrder({ name: "А", email: "bad", phone: "123", address: "", consent: false }, "courier");
  assert.deepEqual(Object.keys(errors), ["name", "email", "phone", "address", "consent"]);
});

test("validateOrder does not require an address for pickup", () => {
  const errors = validateOrder({ name: "Ира", email: "ira@example.ru", phone: "89991234567", address: "", consent: true }, "pickup");
  assert.equal(errors.address, undefined);
});
