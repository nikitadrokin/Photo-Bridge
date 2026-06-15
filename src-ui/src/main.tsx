import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { PageHeaderActionsProvider } from '@/components/app-page-chrome';
import { getRouter } from './router';
import './styles.css';

const router = getRouter();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PageHeaderActionsProvider>
      <RouterProvider router={router} />
    </PageHeaderActionsProvider>
  </StrictMode>,
);
