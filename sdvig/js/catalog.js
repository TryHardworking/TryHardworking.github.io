export const BRAND = "СДВИГ";
export const STORAGE_KEY = "sdvig:shop:v1";
export const FREE_DELIVERY_FROM = 12000;
export const MAX_CART_LINES = 72;
export const MAX_QUANTITY = 9;

export const CATEGORIES = Object.freeze([
  { id: "all", name: "Все вещи" },
  { id: "tops", name: "Верх" },
  { id: "bottoms", name: "Низ" },
  { id: "outerwear", name: "Верхняя одежда" },
  { id: "accessories", name: "Аксессуары" },
]);

export const COLORS = Object.freeze({
  chalk: { name: "Мел", hex: "#eeeae0", family: "light" },
  ink: { name: "Чернила", hex: "#35333b", family: "dark" },
  lilac: { name: "Пыльная сирень", hex: "#b6a5c5", family: "color" },
  moss: { name: "Мох", hex: "#737a65", family: "color" },
  stone: { name: "Камень", hex: "#a3a095", family: "light" },
  rust: { name: "Терракота", hex: "#aa6552", family: "color" },
});

const variant = (color, stock) => ({
  color,
  stock,
});

const definitions = [
  {
    id: "pause", name: "Лонгслив «Пауза»", short: "Пауза", category: "tops", type: "longsleeve",
    price: 3900, rank: 1, isNew: true, tag: "База с характером", fit: "Свободная посадка",
    composition: "100% хлопок · плотность 240 г/м²", care: "Деликатная стирка при 30 °C. Сушить естественным способом, гладить с изнанки.",
    description: "Плотный хлопок, чуть спущенное плечо и длинный рукав. Тот самый первый слой, который не хочется менять.",
    measurements: { XS: [106, 66], S: [112, 68], M: [118, 70], L: [124, 72], XL: [130, 74] },
    variants: [variant("chalk", { XS: 3, S: 5, M: 6, L: 4, XL: 2 }), variant("ink", { XS: 2, S: 4, M: 5, L: 3, XL: 0 }), variant("lilac", { XS: 2, S: 3, M: 2, L: 0, XL: 1 })],
  },
  {
    id: "orbit", name: "Брюки «Орбита»", short: "Орбита", category: "bottoms", type: "trousers",
    price: 6900, rank: 2, isNew: true, tag: "Свобода движения", fit: "Широкие · средняя посадка",
    composition: "98% хлопок, 2% эластан", care: "Стирать при 30 °C, вывернув наизнанку. Не использовать отбеливатель.",
    description: "Прямые широкие брюки с мягким поясом и глубокими карманами. Достаточно собранные для встреч, достаточно свободные для всего остального.",
    measurements: { XS: [66, 101], S: [72, 103], M: [78, 105], L: [84, 107], XL: [90, 109] },
    variants: [variant("ink", { XS: 3, S: 4, M: 5, L: 3, XL: 2 }), variant("stone", { XS: 2, S: 4, M: 4, L: 2, XL: 1 })],
  },
  {
    id: "shift", name: "Рубашка «Сдвиг»", short: "Сдвиг", category: "tops", type: "shirt",
    price: 5900, rank: 3, isNew: false, tag: "Носи вторым слоем", fit: "Объёмная посадка",
    composition: "70% хлопок, 30% лён", care: "Стирка при 30 °C. Лёгкая помятость — часть характера льна.",
    description: "Рубашка с большим нагрудным карманом и асимметричной строчкой. Застегни, распахни или накинь поверх футболки — правил нет.",
    measurements: { XS: [112, 70], S: [118, 72], M: [124, 74], L: [130, 76], XL: [136, 78] },
    variants: [variant("moss", { XS: 2, S: 4, M: 4, L: 3, XL: 1 }), variant("chalk", { XS: 2, S: 3, M: 5, L: 2, XL: 0 })],
  },
  {
    id: "volume", name: "Худи «Объём»", short: "Объём", category: "tops", type: "hoodie",
    price: 7900, rank: 4, isNew: true, tag: "Тепло внутри", fit: "Oversize · без начёса",
    composition: "80% хлопок, 20% полиэстер · футер 420 г/м²", care: "Стирка при 30 °C. Не сушить в машине. Расправить после стирки.",
    description: "Увесистый футер, двойной капюшон и карман, в котором можно спрятать руки от города. Небольшой знак на груди вместо громкого логотипа.",
    measurements: { XS: [116, 66], S: [122, 68], M: [128, 70], L: [134, 72], XL: [140, 74] },
    variants: [variant("lilac", { XS: 2, S: 4, M: 4, L: 3, XL: 1 }), variant("ink", { XS: 0, S: 3, M: 3, L: 2, XL: 1 })],
  },
  {
    id: "contour", name: "Куртка «Контур»", short: "Контур", category: "outerwear", type: "jacket",
    price: 11900, rank: 5, isNew: true, tag: "Слой на каждый день", fit: "Прямой крой · подкладка",
    composition: "Верх: 100% хлопок. Подкладка: 100% полиэстер", care: "Деликатная профессиональная чистка. Не использовать машинную сушку.",
    description: "Лаконичная рабочая куртка с четырьмя карманами. Держит форму и оставляет место для тёплого второго слоя.",
    measurements: { XS: [112, 66], S: [118, 68], M: [124, 70], L: [130, 72], XL: [136, 74] },
    variants: [variant("ink", { XS: 1, S: 3, M: 3, L: 2, XL: 1 }), variant("moss", { XS: 1, S: 2, M: 2, L: 1, XL: 0 })],
  },
  {
    id: "point", name: "Футболка «Точка»", short: "Точка", category: "tops", type: "tee",
    price: 2900, rank: 6, isNew: false, tag: "Ничего лишнего", fit: "Прямой свободный крой",
    composition: "100% хлопок · плотность 220 г/м²", care: "Стирка при 30 °C. Гладить при средней температуре с изнанки.",
    description: "Простая футболка, у которой всё на своём месте: плотная горловина, правильная длина и небольшой знак у нижнего края.",
    measurements: { XS: [102, 65], S: [108, 67], M: [114, 69], L: [120, 71], XL: [126, 73] },
    variants: [variant("chalk", { XS: 4, S: 6, M: 7, L: 5, XL: 3 }), variant("ink", { XS: 3, S: 5, M: 5, L: 4, XL: 2 }), variant("rust", { XS: 1, S: 2, M: 3, L: 2, XL: 0 })],
  },
  {
    id: "line", name: "Юбка «Линия»", short: "Линия", category: "bottoms", type: "skirt",
    price: 5900, rank: 7, isNew: false, tag: "Спокойная геометрия", fit: "А-силуэт · длина миди",
    composition: "65% хлопок, 35% вискоза", care: "Деликатная стирка при 30 °C. Не выкручивать. Гладить с изнанки.",
    description: "А-силуэт с небольшим смещением шва и боковым карманом. Работает и с объёмным худи, и с самой простой футболкой.",
    measurements: { XS: [64, 77], S: [70, 78], M: [76, 79], L: [82, 80] },
    variants: [variant("ink", { XS: 2, S: 3, M: 4, L: 2 }), variant("moss", { XS: 1, S: 2, M: 2, L: 1 })],
  },
  {
    id: "rhythm", name: "Свитер «Ритм»", short: "Ритм", category: "tops", type: "knit",
    price: 8900, rank: 8, isNew: true, tag: "Мягкий рельеф", fit: "Свободная посадка",
    composition: "50% шерсть, 30% хлопок, 20% полиамид", care: "Ручная стирка в прохладной воде. Сушить горизонтально, не растягивая.",
    description: "Крупный рубчик, мягкая горловина и длинный рукав. Согревает, но не утяжеляет образ.",
    measurements: { XS: [110, 64], S: [116, 66], M: [122, 68], L: [128, 70] },
    variants: [variant("stone", { XS: 2, S: 3, M: 3, L: 1 }), variant("lilac", { XS: 1, S: 2, M: 2, L: 0 })],
  },
  {
    id: "route", name: "Пальто «Маршрут»", short: "Маршрут", category: "outerwear", type: "coat",
    price: 15900, rank: 9, isNew: false, tag: "Самый длинный слой", fit: "Прямой крой · длина миди",
    composition: "60% шерсть, 40% полиэстер. Подкладка: вискоза", care: "Только профессиональная сухая чистка. Хранить на широких плечиках.",
    description: "Длинное пальто без жёстких плеч и лишней фурнитуры. Для маршрутов, которые не заканчиваются после работы.",
    measurements: { XS: [114, 112], S: [120, 114], M: [126, 116], L: [132, 118] },
    variants: [variant("stone", { XS: 1, S: 2, M: 2, L: 1 }), variant("ink", { XS: 0, S: 1, M: 2, L: 1 })],
  },
  {
    id: "distance", name: "Джоггеры «Дистанция»", short: "Дистанция", category: "bottoms", type: "joggers",
    price: 4900, rank: 10, isNew: false, tag: "В своём темпе", fit: "Свободные · пояс на резинке",
    composition: "80% хлопок, 20% полиэстер · футер", care: "Стирка при 30 °C. Не использовать отбеливатель и машинную сушку.",
    description: "Мягкие брюки с карманами и регулируемым поясом. Для длинных прогулок, коротких выходов и выходных без плана.",
    measurements: { XS: [64, 98], S: [70, 100], M: [76, 102], L: [82, 104], XL: [88, 106] },
    variants: [variant("ink", { XS: 2, S: 3, M: 4, L: 3, XL: 1 }), variant("lilac", { XS: 1, S: 2, M: 2, L: 1, XL: 0 })],
  },
  {
    id: "pocket", name: "Сумка «Карман»", short: "Карман", category: "accessories", type: "bag",
    price: 2500, rank: 11, isNew: false, tag: "Всё важное рядом", fit: "Один размер · 38 × 42 см",
    composition: "100% хлопок · плотный канвас", care: "Локальная чистка или деликатная стирка при 30 °C. Сушить расправленной.",
    description: "Большой мягкий шопер с внутренним карманом для ключей. Складывается в маленький, вмещает почти весь день.",
    measurements: { ONE: [38, 42] },
    variants: [variant("moss", { ONE: 5 }), variant("chalk", { ONE: 4 }), variant("ink", { ONE: 3 })],
  },
  {
    id: "accent", name: "Шапка «Акцент»", short: "Акцент", category: "accessories", type: "beanie",
    price: 1900, rank: 12, isNew: true, tag: "Маленькое отличие", fit: "Один размер · эластичная вязка",
    composition: "50% шерсть, 50% акрил", care: "Ручная стирка в прохладной воде. Сушить на горизонтальной поверхности.",
    description: "Шапка в рубчик с широким отворотом. Последний штрих или единственный цветовой акцент — решать тебе.",
    measurements: { ONE: [52, 22] },
    variants: [variant("rust", { ONE: 4 }), variant("ink", { ONE: 6 }), variant("lilac", { ONE: 3 })],
  },
];

export const PRODUCTS = Object.freeze(definitions.map((product) => Object.freeze({
  ...product,
  sizes: Object.freeze(Object.keys(product.measurements)),
  variants: Object.freeze(product.variants.map((item) => Object.freeze({
    ...item,
    stock: Object.freeze(item.stock),
    image: `assets/products/${product.id}-${item.color}.svg`,
    backImage: `assets/products/${product.id}-${item.color}-back.svg`,
  }))),
})));

export const LOOKS = Object.freeze([
  {
    id: "daily", number: "01", name: "День без плана", subtitle: "Кофе, город, ещё один поворот.",
    note: "Первый слой + свободные брюки + всё нужное с собой.",
    items: [{ productId: "pause", color: "chalk" }, { productId: "orbit", color: "ink" }, { productId: "pocket", color: "moss" }],
  },
  {
    id: "slow", number: "02", name: "На своей волне", subtitle: "Мягкая посадка. Спокойный темп.",
    note: "Объёмный верх + мягкий низ + маленький цветовой акцент.",
    items: [{ productId: "volume", color: "lilac" }, { productId: "distance", color: "ink" }, { productId: "accent", color: "rust" }],
  },
  {
    id: "evening", number: "03", name: "После шести", subtitle: "Никакого дресс-кода. Только ты.",
    note: "Простой верх + чёткий силуэт + ещё один слой.",
    items: [{ productId: "point", color: "chalk" }, { productId: "line", color: "ink" }, { productId: "contour", color: "moss" }],
  },
]);

export const DELIVERY = Object.freeze({
  point: { name: "Пункт выдачи", price: 350, needsAddress: true, placeholder: "Город и адрес удобного пункта выдачи" },
  courier: { name: "Курьер", price: 650, needsAddress: true, placeholder: "Город, улица, дом, квартира" },
  pickup: { name: "Самовывоз (демо)", price: 0, needsAddress: false, placeholder: "" },
});

export const COUPONS = Object.freeze({ SDVIG10: 10 });

export const getProduct = (id) => PRODUCTS.find((product) => product.id === id);
export const getVariant = (product, color) => product?.variants.find((item) => item.color === color);
export const sizeLabel = (size) => size === "ONE" ? "ONE SIZE" : size;
export const money = (amount) => `${new Intl.NumberFormat("ru-RU").format(amount)} ₽`;
