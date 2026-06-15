import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // Only redirect if __TAURI_INTERNALS__ exists (is not undefined)
    if (typeof (window as any).__TAURI_INTERNALS__ !== 'undefined') {
      throw redirect({ to: '/convert' });
    }
  },
  component: IndexPage,
});

function IndexPage() {
  return <div>IndexPage</div>;
}
