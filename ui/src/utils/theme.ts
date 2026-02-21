/**
 * Applies CSS custom properties for a named theme to the document root.
 */
export function applyTheme(theme: string): void {
  const vars: Record<string, string> =
    theme === 'light'
      ? {
          '--color-bg': '#f5f5f5',
          '--color-surface': '#ffffff',
          '--color-accent': '#4fc3f7',
          '--color-text': '#212121',
          '--color-text-secondary': '#616161',
          '--color-border': '#e0e0e0',
        }
      : theme === 'amoled'
        ? {
            '--color-bg': '#000000',
            '--color-surface': '#0a0a0a',
            '--color-accent': '#00e5ff',
            '--color-text': '#e0e0e0',
            '--color-text-secondary': '#9e9e9e',
            '--color-border': '#111111',
          }
        : {
            '--color-bg': '#0d0d0d',
            '--color-surface': '#1a1a1a',
            '--color-accent': '#4fc3f7',
            '--color-text': '#e0e0e0',
            '--color-text-secondary': '#9e9e9e',
            '--color-border': '#2a2a2a',
          };

  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}
