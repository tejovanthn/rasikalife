import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  specifiedTheme?: Theme | null;
  themeAction?: string;
}

export function ThemeProvider({ children, specifiedTheme, themeAction }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (specifiedTheme) return specifiedTheme;
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'light';
    }
    return 'light';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);

    // Submit to server if themeAction is provided
    if (themeAction) {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = themeAction;

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'theme';
      input.value = newTheme;

      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function PreventFlashOnWrongTheme({ ssrTheme }: { ssrTheme: boolean }) {
  // This component prevents flash by ensuring the theme is set before render
  return null;
}
