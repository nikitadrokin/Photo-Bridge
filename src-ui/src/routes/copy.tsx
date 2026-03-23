import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/copy')({
  beforeLoad: () => {
    throw redirect({ to: '/convert', search: { mode: 'copy' } });
  },
});
