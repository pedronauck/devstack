import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");

  const effectiveTheme = theme === "system" ? getSystemTheme() : theme;
  root.classList.add(effectiveTheme);
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function getThemeStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const storage = window.localStorage;
  if (
    storage &&
    typeof storage.getItem === "function" &&
    typeof storage.setItem === "function" &&
    typeof storage.removeItem === "function"
  ) {
    return storage;
  }

  return undefined;
}

function getStoredTheme(): Theme | null {
  const storage = getThemeStorage();
  if (!storage) {
    return null;
  }

  const stored = storage.getItem("{{projectName}}-theme");
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored);
    return parsed?.state?.theme ?? null;
  } catch {
    return null;
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      theme: "system",
      setTheme: theme => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: "{{projectName}}-theme",
      storage: createJSONStorage(() => getThemeStorage() ?? noopStorage),
      onRehydrateStorage: () => state => {
        if (state?.theme) {
          applyTheme(state.theme);
        }
      },
    }
  )
);

// Initialize theme on first load
if (typeof window !== "undefined") {
  const storedTheme = getStoredTheme();
  applyTheme(storedTheme ?? "system");
}
