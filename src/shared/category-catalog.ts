import type { BudgetCategoryKind } from "@/shared/types";

export type CategoryCatalogEntry = {
  id: string;
  kind: BudgetCategoryKind;
  name: string;
  group: string;
  popular: boolean;
};

/** Исчерпывающий статический каталог; в Redis попадают только выбранные пользователем. */
export const CATEGORY_CATALOG: CategoryCatalogEntry[] = [
  // ——— Расходы ———
  { id: "exp-rent", kind: "expense", name: "Аренда жилья", group: "Жильё", popular: true },
  { id: "exp-mortgage", kind: "expense", name: "Ипотека", group: "Жильё", popular: true },
  { id: "exp-utilities", kind: "expense", name: "ЖКУ", group: "Жильё", popular: true },
  { id: "exp-internet-home", kind: "expense", name: "Интернет дома", group: "Жильё", popular: false },
  { id: "exp-repair", kind: "expense", name: "Ремонт и мебель", group: "Жильё", popular: false },
  { id: "exp-property-tax", kind: "expense", name: "Налог на имущество", group: "Жильё", popular: false },
  { id: "exp-hoa", kind: "expense", name: "ТСЖ / охрана", group: "Жильё", popular: false },

  { id: "exp-groceries", kind: "expense", name: "Продукты", group: "Еда", popular: true },
  { id: "exp-cafes", kind: "expense", name: "Кафе и рестораны", group: "Еда", popular: true },
  { id: "exp-delivery", kind: "expense", name: "Доставка еды", group: "Еда", popular: false },
  { id: "exp-coffee", kind: "expense", name: "Кофе и перекусы", group: "Еда", popular: false },

  { id: "exp-fuel", kind: "expense", name: "Бензин / зарядка", group: "Транспорт", popular: true },
  { id: "exp-public-transport", kind: "expense", name: "Общественный транспорт", group: "Транспорт", popular: true },
  { id: "exp-taxi", kind: "expense", name: "Такси / каршеринг", group: "Транспорт", popular: false },
  { id: "exp-car-loan", kind: "expense", name: "Автокредит", group: "Транспорт", popular: false },
  { id: "exp-car-service", kind: "expense", name: "ТО и ремонт авто", group: "Транспорт", popular: false },
  { id: "exp-parking", kind: "expense", name: "Парковка", group: "Транспорт", popular: false },
  { id: "exp-osago", kind: "expense", name: "ОСАГО / КАСКО", group: "Транспорт", popular: false },

  { id: "exp-medicine", kind: "expense", name: "Лекарства", group: "Здоровье", popular: true },
  { id: "exp-doctors", kind: "expense", name: "Врачи и анализы", group: "Здоровье", popular: false },
  { id: "exp-dms", kind: "expense", name: "ДМС / страховка здоровья", group: "Здоровье", popular: false },
  { id: "exp-dental", kind: "expense", name: "Стоматология", group: "Здоровье", popular: false },
  { id: "exp-psychology", kind: "expense", name: "Психология", group: "Здоровье", popular: false },

  { id: "exp-mobile", kind: "expense", name: "Мобильная связь", group: "Связь", popular: true },
  { id: "exp-cloud", kind: "expense", name: "Облако и сервисы", group: "Связь", popular: false },

  { id: "exp-clothes", kind: "expense", name: "Одежда и обувь", group: "Одежда", popular: true },
  { id: "exp-accessories", kind: "expense", name: "Аксессуары", group: "Одежда", popular: false },
  { id: "exp-laundry", kind: "expense", name: "Химчистка", group: "Одежда", popular: false },

  { id: "exp-kids-food", kind: "expense", name: "Детское питание", group: "Дети", popular: false },
  { id: "exp-kids-clothes", kind: "expense", name: "Детская одежда", group: "Дети", popular: false },
  { id: "exp-kindergarten", kind: "expense", name: "Садик / няня", group: "Дети", popular: false },
  { id: "exp-kids-activities", kind: "expense", name: "Кружки и секции", group: "Дети", popular: false },
  { id: "exp-kids-toys", kind: "expense", name: "Игрушки", group: "Дети", popular: false },

  { id: "exp-courses", kind: "expense", name: "Курсы и обучение", group: "Образование", popular: false },
  { id: "exp-books", kind: "expense", name: "Книги", group: "Образование", popular: false },
  { id: "exp-school", kind: "expense", name: "Школа / вуз", group: "Образование", popular: false },

  { id: "exp-streaming", kind: "expense", name: "Стриминг", group: "Подписки", popular: true },
  { id: "exp-software", kind: "expense", name: "ПО и приложения", group: "Подписки", popular: false },
  { id: "exp-news", kind: "expense", name: "Медиа и новости", group: "Подписки", popular: false },
  { id: "exp-games-sub", kind: "expense", name: "Игровые подписки", group: "Подписки", popular: false },

  { id: "exp-entertainment", kind: "expense", name: "Развлечения", group: "Досуг", popular: true },
  { id: "exp-hobbies", kind: "expense", name: "Хобби", group: "Досуг", popular: false },
  { id: "exp-events", kind: "expense", name: "Концерты и события", group: "Досуг", popular: false },
  { id: "exp-games", kind: "expense", name: "Игры", group: "Досуг", popular: false },

  { id: "exp-travel", kind: "expense", name: "Путешествия", group: "Путешествия", popular: false },
  { id: "exp-hotels", kind: "expense", name: "Отели", group: "Путешествия", popular: false },
  { id: "exp-flights", kind: "expense", name: "Авиа и ж/д", group: "Путешествия", popular: false },
  { id: "exp-visa", kind: "expense", name: "Визы и сборы", group: "Путешествия", popular: false },

  { id: "exp-life-insurance", kind: "expense", name: "Страхование жизни", group: "Страхование", popular: false },
  { id: "exp-property-ins", kind: "expense", name: "Страхование имущества", group: "Страхование", popular: false },

  { id: "exp-taxes", kind: "expense", name: "Налоги", group: "Налоги и штрафы", popular: false },
  { id: "exp-fines", kind: "expense", name: "Штрафы", group: "Налоги и штрафы", popular: false },
  { id: "exp-fees", kind: "expense", name: "Госпошлины", group: "Налоги и штрафы", popular: false },

  { id: "exp-loan-payment", kind: "expense", name: "Платежи по кредитам", group: "Долги", popular: false },
  { id: "exp-credit-card", kind: "expense", name: "Кредитная карта", group: "Долги", popular: false },
  { id: "exp-microloan", kind: "expense", name: "Микрозаймы", group: "Долги", popular: false },

  { id: "exp-gifts", kind: "expense", name: "Подарки", group: "Подарки", popular: false },
  { id: "exp-charity", kind: "expense", name: "Благотворительность", group: "Подарки", popular: false },
  { id: "exp-celebrations", kind: "expense", name: "Праздники", group: "Подарки", popular: false },

  { id: "exp-pet-food", kind: "expense", name: "Корм питомцам", group: "Питомцы", popular: false },
  { id: "exp-vet", kind: "expense", name: "Ветеринар", group: "Питомцы", popular: false },
  { id: "exp-pet-care", kind: "expense", name: "Уход за питомцами", group: "Питомцы", popular: false },

  { id: "exp-gym", kind: "expense", name: "Спортзал", group: "Спорт", popular: false },
  { id: "exp-sport-gear", kind: "expense", name: "Спорттовары", group: "Спорт", popular: false },
  { id: "exp-fitness", kind: "expense", name: "Тренер / занятия", group: "Спорт", popular: false },

  { id: "exp-cosmetics", kind: "expense", name: "Косметика", group: "Красота", popular: false },
  { id: "exp-salon", kind: "expense", name: "Салон красоты", group: "Красота", popular: false },
  { id: "exp-barber", kind: "expense", name: "Парикмахерская", group: "Красота", popular: false },

  { id: "exp-household", kind: "expense", name: "Бытовые товары", group: "Прочее", popular: false },
  { id: "exp-electronics", kind: "expense", name: "Электроника", group: "Прочее", popular: false },
  { id: "exp-cash", kind: "expense", name: "Наличные / разное", group: "Прочее", popular: true },
  { id: "exp-other", kind: "expense", name: "Прочие расходы", group: "Прочее", popular: true },

  // ——— Доходы ———
  { id: "inc-salary", kind: "income", name: "Зарплата", group: "Работа", popular: true },
  { id: "inc-bonus", kind: "income", name: "Премия", group: "Работа", popular: true },
  { id: "inc-freelance", kind: "income", name: "Фриланс", group: "Работа", popular: true },
  { id: "inc-side", kind: "income", name: "Подработка", group: "Работа", popular: false },
  { id: "inc-business", kind: "income", name: "Бизнес", group: "Бизнес", popular: true },
  { id: "inc-dividends", kind: "income", name: "Дивиденды", group: "Инвестиции", popular: true },
  { id: "inc-interest", kind: "income", name: "Проценты по вкладам", group: "Инвестиции", popular: false },
  { id: "inc-capital-gains", kind: "income", name: "Доход от продажи активов", group: "Инвестиции", popular: false },
  { id: "inc-rental", kind: "income", name: "Аренда имущества", group: "Пассивный доход", popular: true },
  { id: "inc-royalties", kind: "income", name: "Роялти", group: "Пассивный доход", popular: false },
  { id: "inc-pension", kind: "income", name: "Пенсия", group: "Социальные", popular: false },
  { id: "inc-benefits", kind: "income", name: "Пособия", group: "Социальные", popular: false },
  { id: "inc-alimony", kind: "income", name: "Алименты", group: "Социальные", popular: false },
  { id: "inc-cashback", kind: "income", name: "Кешбэк", group: "Возвраты", popular: false },
  { id: "inc-tax-refund", kind: "income", name: "Налоговый вычет", group: "Возвраты", popular: false },
  { id: "inc-refunds", kind: "income", name: "Возвраты покупок", group: "Возвраты", popular: false },
  { id: "inc-gifts", kind: "income", name: "Подарки и помощь", group: "Прочее", popular: false },
  { id: "inc-other", kind: "income", name: "Прочие доходы", group: "Прочее", popular: true },
];

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function filterCatalog(
  query: string,
  kind: BudgetCategoryKind,
): CategoryCatalogEntry[] {
  const q = norm(query);
  return CATEGORY_CATALOG.filter((e) => {
    if (e.kind !== kind) return false;
    if (!q) return true;
    return norm(e.name).includes(q) || norm(e.group).includes(q);
  });
}

/** Популярные из каталога, которых ещё нет среди пользовательских (по имени). */
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
    (e) => e.kind === kind && e.popular && !existing.has(norm(e.name)),
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

/** Seed при первом GET: только популярные expense. */
export function defaultExpenseSeed(): Array<{ name: string; sortOrder: number }> {
  return CATEGORY_CATALOG.filter((e) => e.kind === "expense" && e.popular).map(
    (e, i) => ({ name: e.name, sortOrder: i }),
  );
}

export function groupCatalogEntries(
  entries: CategoryCatalogEntry[],
): Array<{ group: string; items: CategoryCatalogEntry[] }> {
  const map = new Map<string, CategoryCatalogEntry[]>();
  for (const e of entries) {
    const list = map.get(e.group) ?? [];
    list.push(e);
    map.set(e.group, list);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
}
