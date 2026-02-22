import { createBrowserRouter } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { featureFlags } from '../config/featureFlags';
import { AppLayout } from './AppLayout';
import { HealthRoute } from './HealthRoute';
import { HomeEntryRoute } from './HomeEntryRoute';
import { SideQuestRewardsRoute } from './SideQuestRewardsRoute';

const children: RouteObject[] = [
  { index: true, element: <HomeEntryRoute /> },
  { path: 'side-quest-rewards', element: <SideQuestRewardsRoute /> }
];

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
