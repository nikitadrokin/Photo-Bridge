import { Monitor, Moon, Sun } from '@phosphor-icons/react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  const themes = [
    { id: 'light' as const, icon: Sun, label: 'Light' },
    { id: 'system' as const, icon: Monitor, label: 'System' },
    { id: 'dark' as const, icon: Moon, label: 'Dark' },
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!(containerRef.current && mounted)) {
      return;
    }

    const container = containerRef.current;
    const buttons = container.querySelectorAll('button');
    const selectedIndex = themes.findIndex((t) => t.id === theme);
    const selectedButton = buttons[selectedIndex];

    if (selectedButton) {
      const buttonRect = selectedButton.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      const offsetX = buttonRect.left - containerRect.left;
      const buttonWidth = buttonRect.width;

      setHighlightStyle({
        '--highlight-x': `${offsetX}px`,
        '--highlight-width': `${buttonWidth}px`,
        transform: 'translateX(var(--highlight-x))',
        width: 'var(--highlight-width)',
      } as React.CSSProperties);
    }
  }, [theme, mounted]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-between gap-3.5">
        <Sun className="h-[1.2rem] w-[1.2rem] shrink-0" />
        <span className="mr-auto select-none text-sm">Theme</span>
        <div className="relative inline-flex gap-1 rounded-full bg-muted">
          {themes.map((t) => {
            const Icon = t.icon;
            return (
              <button
                className="relative z-10 flex size-8 items-center justify-center rounded-full"
                disabled
                key={t.id}
                type="button"
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3.5">
      <Sun className="h-[1.2rem] w-[1.2rem] shrink-0 rotate-0 scale-100 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] shrink-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="mr-auto select-none text-sm">Theme</span>

      <div
        className="relative inline-flex gap-1 rounded-full bg-muted"
        ref={containerRef}
      >
        <div
          className="absolute top-0 left-0 size-8 rounded-full border shadow-sm transition-transform duration-200 ease-out"
          style={highlightStyle}
        />

        {/* Theme buttons */}
        {themes.map((t) => {
          const Icon = t.icon;
          return (
            <button
              aria-label={`Switch to ${t.label} theme`}
              className={cn(
                'relative z-10 flex size-8 items-center justify-center rounded-full transition-colors duration-200',
                t.id === theme ? 'text-foreground' : 'text-muted-foreground',
              )}
              key={t.id}
              onClick={() => setTheme(t.id)}
              type="button"
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
