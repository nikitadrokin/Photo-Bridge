import { createFileRoute } from '@tanstack/react-router';

import { Field, FieldLabel } from '@/components/ui/field';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TERMINAL_APP_SELECT_ITEMS,
  useSettingsStore,
} from '@/stores/settings-store';

export const Route = createFileRoute('/settings')({
  staticData: {
    pageTitle: 'Settings',
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { preferredTerminal, setPreferredTerminal } = useSettingsStore();

  return (
    <main className="flex-1 p-2">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Field>
          <FieldLabel>Default terminal</FieldLabel>
          <Tabs
            value={preferredTerminal}
            aria-label="Default terminal"
            onValueChange={(value) => {
              if (value === 'ghostty' || value === 'terminal') {
                setPreferredTerminal(value);
              }
            }}
          >
            <TabsList className="w-full max-w-sm">
              {TERMINAL_APP_SELECT_ITEMS.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="flex-1"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Field>
      </div>
    </main>
  );
}
