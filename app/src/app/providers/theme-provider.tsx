import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
type Mode = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{ mode: Mode; setMode: (value: Mode) => void }>({
  mode: 'system',
  setMode: () => {},
});
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return (localStorage.getItem('mywallet-theme') as Mode) || 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#081116' : '#f4f7f8');
    };
    apply();
    try {
      localStorage.setItem('mywallet-theme', mode);
    } catch {}
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [mode]);
  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
