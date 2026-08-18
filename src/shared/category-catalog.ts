import type { BudgetCategoryKind } from "@/shared/types";

export type CategoryCatalogEntry = {
  id: string;
  kind: BudgetCategoryKind;
  name: string;
  group: string;
  popular: boolean;
};

function e(
  id: string,
  kind: BudgetCategoryKind,
  name: string,
  group: string,
  popular = false,
): CategoryCatalogEntry {
  return { id, kind, name, group, popular };
}

/** Статический каталог; в Redis только выбранные пользователем. */
export const CATEGORY_CATALOG: CategoryCatalogEntry[] = [
  // Расходы — Авто
  e("exp-auto", "expense", "🚗 Авто", "Авто", true),
  e("exp-auto-parts", "expense", "🔧 Автозапчасти", "Авто"),
  e("exp-auto-service", "expense", "🛠️ Автоуслуги", "Авто"),
  e("exp-gas", "expense", "⛽ АЗС", "Авто", true),
  e("exp-car-rental", "expense", "🔑 Аренда авто", "Авто"),
  // Еда
  e("exp-alcohol", "expense", "🍷 Алкоголь", "Еда"),
  e("exp-cafes", "expense", "🍽️ Кафе и рестораны", "Еда", true),
  e("exp-groceries", "expense", "🥦 Продукты", "Еда", true),
  e("exp-supermarket", "expense", "🛍️ Супермаркеты", "Еда"),
  e("exp-fastfood", "expense", "🍔 Фастфуд", "Еда"),
  e("exp-tobacco", "expense", "🚬 Табак", "Еда"),
  // Жильё
  e("exp-home", "expense", "🏡 Дом и ремонт", "Жильё"),
  e("exp-utilities", "expense", "💡 Коммунальные услуги", "Жильё", true),
  // Транспорт
  e("exp-public-transport", "expense", "🚌 Общественный транспорт", "Транспорт"),
  e("exp-taxi", "expense", "🚕 Такси", "Транспорт"),
  e("exp-transport", "expense", "🚇 Транспорт", "Транспорт", true),
  // Здоровье
  e("exp-pharmacy", "expense", "💊 Аптеки", "Здоровье"),
  e("exp-health", "expense", "🏥 Здоровье", "Здоровье", true),
  e("exp-med-services", "expense", "🩺 Медицинские услуги", "Здоровье"),
  e("exp-health-goods", "expense", "💪 Товары для здоровья", "Здоровье"),
  // Покупки
  e("exp-accessories", "expense", "🎒 Аксессуары", "Покупки"),
  e("exp-marketplace", "expense", "🛒 Маркетплейсы", "Покупки"),
  e("exp-clothes", "expense", "👗 Одежда и обувь", "Покупки", true),
  e("exp-tech", "expense", "💻 Техника", "Покупки"),
  e("exp-digital", "expense", "🖥️ Цифровые товары", "Покупки"),
  e("exp-jewelry", "expense", "💍 Ювелирные изделия", "Покупки"),
  // Досуг
  e("exp-outdoor", "expense", "🏄 Активный отдых", "Досуг"),
  e("exp-books", "expense", "📚 Книги", "Досуг"),
  e("exp-culture", "expense", "🎨 Культура и искусство", "Досуг"),
  e("exp-travel", "expense", "✈️ Путешествия", "Досуг"),
  e("exp-fun", "expense", "🎮 Развлечения", "Досуг"),
  e("exp-sport-goods", "expense", "⚽ Спортивные товары", "Досуг"),
  e("exp-hobby", "expense", "🧵 Хобби", "Досуг"),
  // Семья
  e("exp-kids", "expense", "🧸 Детские товары", "Семья"),
  e("exp-pets", "expense", "🐾 Животные", "Семья"),
  e("exp-pet-goods", "expense", "🐶 Товары для животных", "Семья"),
  // Услуги
  e("exp-charity", "expense", "❤️ Благотворительность", "Услуги"),
  e("exp-beauty", "expense", "💄 Красота", "Услуги"),
  e("exp-education", "expense", "🎓 Образование", "Услуги"),
  e("exp-comms", "expense", "📶 Связь, интернет и ТВ", "Услуги", true),
  // Прочее
  e("exp-fines", "expense", "📃 Штрафы и налоги", "Прочее"),
  e("exp-unknown", "expense", "🤔 Я не помню", "Прочее"),
  e("exp-other", "expense", "📦 Прочее", "Прочее", true),

  // Доходы
  e("inc-salary", "income", "💰 Зарплата", "Работа", true),
  e("inc-bonus", "income", "🏆 Премия", "Работа", true),
  e("inc-side", "income", "🧑‍💻 Подработка", "Работа", true),
  e("inc-invest", "income", "📈 Инвестиции", "Капитал", true),
  e("inc-cashback", "income", "🔄 Кэшбэк", "Капитал"),
  e("inc-rent", "income", "🏠 Рента", "Капитал"),
  e("inc-benefits", "income", "👶 Пособия", "Социальные"),
  e("inc-pension", "income", "🏛️ Пенсия", "Социальные"),
  e("inc-stipend", "income", "🎓 Стипендия", "Социальные"),
  e("inc-family", "income", "🤝 Помощь от близких", "Близкие"),
  e("inc-gift", "income", "🎁 Подарок", "Близкие"),
  e("inc-hobby", "income", "🎨 Хобби", "Прочее"),
  e("inc-other", "income", "📦 Прочие доходы", "Прочее", true),
  e("inc-unknown", "income", "🤔 Я не помню", "Прочее"),
];

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function filterCatalog(
  query: string,
  kind: BudgetCategoryKind,
): CategoryCatalogEntry[] {
  const q = norm(query);
  return CATEGORY_CATALOG.filter((entry) => {
    if (entry.kind !== kind) return false;
    if (!q) return true;
    return norm(entry.name).includes(q) || norm(entry.group).includes(q);
  });
}

export function popularNotAdded(
  kind: BudgetCategoryKind,
  userCategories: Array<{ name: string; kind: BudgetCategoryKind }>,
): CategoryCatalogEntry[] {
  const existing = new Set(
    userCategories
      .filter((c) => c.kind === kind)
      .map((c) => norm(c.name)),
  );
  return CATEGORY_CATALOG.filter(
    (entry) => entry.kind === kind && entry.popular && !existing.has(norm(entry.name)),
  );
}

export function isCatalogNameAdded(
  name: string,
  kind: BudgetCategoryKind,
  userCategories: Array<{ name: string; kind: BudgetCategoryKind }>,
): boolean {
  const n = norm(name);
  return userCategories.some((c) => c.kind === kind && norm(c.name) === n);
}

export function defaultExpenseSeed(): Array<{ name: string; sortOrder: number }> {
  return CATEGORY_CATALOG.filter((entry) => entry.kind === "expense" && entry.popular).map(
    (entry, i) => ({ name: entry.name, sortOrder: i }),
  );
}

export function groupCatalogEntries(
  entries: CategoryCatalogEntry[],
): Array<{ group: string; items: CategoryCatalogEntry[] }> {
  const map = new Map<string, CategoryCatalogEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.group) ?? [];
    list.push(entry);
    map.set(entry.group, list);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
}

/** Топ категорий пользователя по числу привязанных операций. */
export function topFrequentCategories<T extends { id: string; name: string; kind: BudgetCategoryKind }>(
  kind: BudgetCategoryKind,
  userCategories: T[],
  lines: Array<{ category?: string | null }>,
  limit = 5,
): T[] {
  const ofKind = userCategories.filter((c) => c.kind === kind);
  const counts = new Map<string, number>();
  for (const line of lines) {
    const id = line.category;
    if (!id || id === "general") continue;
    if (!ofKind.some((c) => c.id === id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return ofKind
    .filter((c) => (counts.get(c.id) ?? 0) > 0)
    .sort((a, b) => (counts.get(b.id)! - counts.get(a.id)!) || a.name.localeCompare(b.name, "ru"))
    .slice(0, limit);
}
