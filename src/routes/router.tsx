import { createBrowserRouter } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { featureFlags } from '../config/featureFlags';
import { AppLayout } from './AppLayout';
import { HealthRoute } from './HealthRoute';
import { HomeRoute } from './HomeRoute';

const children: RouteObject[] = [{ index: true, element: <HomeRoute /> }];

if (featureFlags.healthCheckRoute) {
  children.push({ path: 'health', element: <HealthRoute /> });
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children
  }
]);
