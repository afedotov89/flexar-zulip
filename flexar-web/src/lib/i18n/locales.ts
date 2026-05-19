// Flexar Hub Web — i18n catalogues (Phase 6.3).
//
// Each top-level key is a feature/section; nested keys are message
// ids. The structure is intentionally human-readable rather than
// flat-dotted so a new locale only needs to mirror the shape.
//
// ── Coverage scope ─────────────────────────────────────────────────
//
// This is the *infrastructure*, not a full extraction. The catalogue
// holds the navbar, the shell-level chrome (drawer toggles, network
// status, keyboard help heading, login form), and the everyday
// landmarks of the chat surface (sidebars, compose placeholder, feed
// empty/error states). Hundreds of feature-local strings still live
// inline RU at their call sites; they migrate as each feature is
// touched. The `t()` accessor falls back to the RU literal at the
// call site if a key is missing, so a partial catalogue never breaks
// the UI.

export type Locale = "ru" | "en";

export const DEFAULT_LOCALE: Locale = "ru";

export interface Messages {
  navbar: {
    brand: string;
    themeToggleToDark: string;
    themeToggleToLight: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    themeMenuPrefix: string;
    statusButton: string;
    statusSet: string;
    statusEdit: string;
    statusEmpty: string;
    accountMenu: string;
    settings: string;
    administration: string;
    logout: string;
    drawerOpenLeft: string;
    drawerCloseLeft: string;
    drawerOpenRight: string;
    drawerCloseRight: string;
  };
  search: {
    placeholder: string;
    ariaLabel: string;
  };
  shell: {
    skipToContent: string;
    leftSidebarAria: string;
    rightSidebarAria: string;
    closeDrawer: string;
  };
  network: {
    offline: string;
    reconnecting: string;
    reconnected: string;
  };
  keyboard: {
    helpTitle: string;
    sectionGeneral: string;
    sectionFeed: string;
    sectionNav: string;
    or: string;
  };
  feed: {
    loadingMessages: string;
    errorTitle: string;
    errorFallback: string;
    retry: string;
    emptyTitle: string;
    emptyDescription: string;
    historyLimited: string;
  };
  language: {
    label: string;
    russian: string;
    english: string;
  };
}

export const messages: Record<Locale, Messages> = {
  ru: {
    navbar: {
      brand: "Flexar Messenger",
      themeToggleToDark: "Тёмная тема",
      themeToggleToLight: "Светлая тема",
      themeLight: "Светлая",
      themeDark: "Тёмная",
      themeSystem: "Системная",
      themeMenuPrefix: "Тема",
      statusButton: "Установить статус",
      statusSet: "Установить статус",
      statusEdit: "Изменить статус",
      statusEmpty: "Нет статуса",
      accountMenu: "Меню аккаунта",
      settings: "Настройки",
      administration: "Администрирование",
      logout: "Выйти",
      drawerOpenLeft: "Открыть боковую панель",
      drawerCloseLeft: "Закрыть боковую панель",
      drawerOpenRight: "Показать участников",
      drawerCloseRight: "Закрыть участников",
    },
    search: {
      placeholder: "Поиск сообщений",
      ariaLabel: "Поиск сообщений",
    },
    shell: {
      skipToContent: "Перейти к сообщениям",
      leftSidebarAria: "Каналы и навигация",
      rightSidebarAria: "О беседе",
      closeDrawer: "Закрыть панель",
    },
    network: {
      offline:
        "Нет соединения с интернетом. Сообщения и обновления приостановлены — мы продолжим, как только связь вернётся.",
      reconnecting: "Восстанавливаем соединение с сервером…",
      reconnected: "Соединение восстановлено.",
    },
    keyboard: {
      helpTitle: "Горячие клавиши",
      sectionGeneral: "Общие",
      sectionFeed: "Лента сообщений",
      sectionNav: "Навигация",
      or: "или",
    },
    feed: {
      loadingMessages: "Загрузка сообщений",
      errorTitle: "Не удалось загрузить сообщения",
      errorFallback: "Что-то пошло не так при загрузке.",
      retry: "Попробовать снова",
      emptyTitle: "Здесь пока нет сообщений",
      emptyDescription:
        "Сообщения, отправленные в этот вид, появятся здесь.",
      historyLimited:
        "Более ранняя история сообщений недоступна на этом тарифе.",
    },
    language: {
      label: "Язык интерфейса",
      russian: "Русский",
      english: "English",
    },
  },
  en: {
    navbar: {
      brand: "Flexar Messenger",
      themeToggleToDark: "Dark theme",
      themeToggleToLight: "Light theme",
      themeLight: "Light",
      themeDark: "Dark",
      themeSystem: "System",
      themeMenuPrefix: "Theme",
      statusButton: "Set status",
      statusSet: "Set status",
      statusEdit: "Edit status",
      statusEmpty: "No status",
      accountMenu: "Account menu",
      settings: "Settings",
      administration: "Administration",
      logout: "Log out",
      drawerOpenLeft: "Open sidebar",
      drawerCloseLeft: "Close sidebar",
      drawerOpenRight: "Show members",
      drawerCloseRight: "Hide members",
    },
    search: {
      placeholder: "Search messages",
      ariaLabel: "Search messages",
    },
    shell: {
      skipToContent: "Skip to messages",
      leftSidebarAria: "Channels and navigation",
      rightSidebarAria: "About this conversation",
      closeDrawer: "Close panel",
    },
    network: {
      offline:
        "You're offline. Sending and live updates are paused — we'll resume the moment the connection is back.",
      reconnecting: "Reconnecting to the server…",
      reconnected: "You're back online.",
    },
    keyboard: {
      helpTitle: "Keyboard shortcuts",
      sectionGeneral: "General",
      sectionFeed: "Message list",
      sectionNav: "Navigation",
      or: "or",
    },
    feed: {
      loadingMessages: "Loading messages",
      errorTitle: "Couldn't load messages",
      errorFallback: "Something went wrong while loading.",
      retry: "Try again",
      emptyTitle: "Nothing here yet",
      emptyDescription: "Messages sent to this view will appear here.",
      historyLimited:
        "Older message history isn't available on the current plan.",
    },
    language: {
      label: "Interface language",
      russian: "Russian",
      english: "English",
    },
  },
};
