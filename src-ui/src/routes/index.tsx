import { createFileRoute } from '@tanstack/react-router';
import { IconLayoutSidebar, IconSparkles } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const Route = createFileRoute('/')({
  staticData: {
    pageTitle: 'Tauri Template',
  },
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <section className="grid gap-4">
        <Badge variant="secondary" className="w-fit">
          Starter shell
        </Badge>
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">
            A clean Tauri app shell.
          </h2>
          <p className="text-muted-foreground text-sm leading-6">
            This template keeps the custom window chrome, drag regions, theme
            support, and sidebar patterns while leaving the product-specific
            app code out.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconLayoutSidebar className="size-4" />
              Sidebar Patterns
            </CardTitle>
            <CardDescription>
              The sidebar includes examples of each exported sidebar primitive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline">
              Replace with your first action
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSparkles className="size-4" />
              Ready To Customize
            </CardTitle>
            <CardDescription>
              Add routes, wire native commands, and rename the app for the next
              project.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
