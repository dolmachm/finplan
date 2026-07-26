import { FAQ_ITEMS } from "@/content/help";

export const SUPPORT_LOCATION_OPTIONS = [
  { value: "nav", label: "Навигация / меню" },
  { value: "form", label: "Форма / ввод данных" },
  { value: "chart", label: "График / расчёт" },
  { value: "export", label: "Экспорт / импорт" },
  { value: "other", label: "Другое" },
] as const;

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Открыт",
  WAITING_USER: "Ждёт вас",
  CLOSED: "Закрыт",
};

/** FAQ question indexes (into FAQ_ITEMS) suggested by dashboard tab */
const FAQ_BY_TAB: Record<string, number[]> = {
  home: [0, 1, 3],
  assets: [1, 2, 3],
  plan: [4, 5, 6],
  export: [14, 15, 12],
};

export function suggestFaq(dashboardTab: string | null | undefined, query = "") {
  const indices =
    (dashboardTab && FAQ_BY_TAB[dashboardTab]) || FAQ_BY_TAB.home;
  const q = query.trim().toLowerCase();
  let picked = indices
    .map((i) => FAQ_ITEMS[i])
    .filter(Boolean)
    .slice(0, 3);

  if (q.length >= 3) {
    const scored = FAQ_ITEMS.map((item) => {
      const hay = `${item.q} ${item.a}`.toLowerCase();
      const hit = q.split(/\s+/).filter((w) => w.length > 2 && hay.includes(w)).length;
      return { item, hit };
    })
      .filter((x) => x.hit > 0)
      .sort((a, b) => b.hit - a.hit)
      .slice(0, 3)
      .map((x) => x.item);
    if (scored.length > 0) picked = scored;
  }

  return picked;
}

export function buildSystemAutoReply(dashboardTab: string | null | undefined): string {
  const tips = suggestFaq(dashboardTab);
  const tipLines = tips
    .map((t) => `• ${t.q}`)
    .join("\n");
  return [
    "Спасибо за обращение! Мы получили ваше сообщение и ответим в ближайшее время (обычно в течение 1 рабочего дня).",
    "",
    "Пока ждёте, загляните в FAQ — часто помогает:",
    tipLines || "• Откройте раздел FAQ в меню кабинета",
    "",
    "Полный FAQ: /faq",
  ].join("\n");
}

export const ADMIN_QUICK_REPLIES = [
  {
    id: "greeting",
    label: "Принято",
    body: "Здравствуйте! Получили ваше обращение, разбираемся. Напишем, как разберёмся.",
  },
  {
    id: "empty-plan",
    label: "Пустой план",
    body: "Пустой план или график обычно значит, что не хватает данных. Заполните вкладку «Данные» по шагам (баланс → поток → цели) и обновите «План». Если ошибка останется — опишите, что именно видите на экране.",
  },
  {
    id: "csv",
    label: "CSV",
    body: "Для импорта CSV нужен файл с колонками type (asset|income|expense), name, amount. Разделитель — запятая, кодировка UTF-8. Загрузка — на вкладке «Экспорт».",
  },
  {
    id: "login",
    label: "Вход",
    body: "Если не получается войти: проверьте email и пароль, очистите cookies для сайта или откройте в режиме инкогнито. Если аккаунт новый — убедитесь, что регистрация прошла успешно.",
  },
  {
    id: "data",
    label: "Данные",
    body: "Правьте суммы и записи на вкладке «Данные». История изменений есть в журнале на той же вкладке. Если запись «пропала» — напишите название и примерно когда меняли.",
  },
  {
    id: "plan",
    label: "План / MC",
    body: "«План» — быстрый прогноз; «Инвест-план» — годовой калькулятор; прогноз риска (Monte Carlo) может идти минуту — дождитесь статуса «готово». Если расчёт завис или ошибка — пришлите статус из очереди и что нажали.",
  },
  {
    id: "need-info",
    label: "Нужны детали",
    body: "Чтобы помочь точнее, напишите: 1) что ожидали увидеть; 2) что произошло вместо этого; 3) менялись ли данные перед этим. Спасибо!",
  },
  {
    id: "closed",
    label: "Закрыто",
    body: "Похоже, вопрос решён. Закрываем обращение. Если проблема вернётся — откройте новое или ответьте в этой ветке.",
  },
] as const;
