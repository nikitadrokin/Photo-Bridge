import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';

const THEMES = [
  { id: 'light' as const, icon: IconSun, label: 'Light' },
  { id: 'system' as const, icon: IconDeviceDesktop, label: 'System' },
  { id: 'dark' as const, icon: IconMoon, label: 'Dark' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const selectedIndex = Math.max(
    0,
    THEMES.findIndex((t) => t.id === theme),
  );

  return (
    <div className="flex items-center justify-between gap-3.5">
      <IconSun className="h-[1.2rem] w-[1.2rem] shrink-0 rotate-0 scale-100 transition-all dark:scale-0 dark:-rotate-90" />
      <IconMoon className="absolute h-[1.2rem] w-[1.2rem] shrink-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="mr-auto select-none text-sm">Theme</span>

      <div
        role="radiogroup"
        aria-label="Theme"
        className="relative inline-flex gap-1 rounded-full bg-muted"
      >
        {/* Segments are a fixed size-8 with gap-1, so the highlight only needs
            a translate — no measurement, no width animation. */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 size-8 rounded-full border shadow-sm transition-transform duration-200 ease-out"
          style={{ transform: `translateX(calc(${selectedIndex} * 2.25rem))` }}
        />

        {THEMES.map((t) => {
          const Icon = t.icon;
          const isSelected = t.id === theme;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Switch to ${t.label} theme`}
              className={cn(
                'relative z-10 flex size-8 items-center justify-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                isSelected ? 'text-foreground' : 'text-muted-foreground',
              )}
              onClick={() => setTheme(t.id)}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
