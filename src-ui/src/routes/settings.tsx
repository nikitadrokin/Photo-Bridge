import { createFileRoute } from '@tanstack/react-router';

import { CliToolsSettings } from '@/components/cli-tools-settings';
import { Field, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TERMINAL_APP_SELECT_ITEMS,
  useSettingsStore,
} from '@/stores/settings-store';
import SplitColumn from '@/components/ui/split-column';

export const Route = createFileRoute('/settings')({
  staticData: {
    pageTitle: 'Settings',
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { preferredTerminal, setPreferredTerminal } = useSettingsStore();

  return (
    <div className="p-4 grid space-y-6">
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

      <Separator />
      <CliToolsSettings />
    </div>
  );
}
