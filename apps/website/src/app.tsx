import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { KeywordsTab } from '@/components/dashboard/keywords-tab';
import { ListingsTab } from '@/components/dashboard/listings-tab';
import { LogsTab } from '@/components/dashboard/logs-tab';
import { ShopActivityTab } from '@/components/dashboard/shop-activity-tab';
import { ShopsTab } from '@/components/dashboard/shops-tab';

const router = createBrowserRouter([
    {
        path: '/',
        element: <DashboardShell />,
        children: [
            {
                index: true,
                element: (
                    <div className="h-full">
                        <ListingsTab />
                    </div>
                ),
            },
            {
                path: 'keywords',
                element: (
                    <div className="h-full">
                        <KeywordsTab />
                    </div>
                ),
            },
            {
                path: 'shops',
                element: (
                    <div className="h-full">
                        <ShopsTab />
                    </div>
                ),
            },
            {
                path: 'shops/activity/:etsyShopId',
                element: (
                    <div className="h-full">
                        <ShopActivityTab />
                    </div>
                ),
            },
            {
                path: 'logs',
                element: (
                    <div className="h-full">
                        <LogsTab />
                    </div>
                ),
            },
            {
                path: '*',
                element: <Navigate replace to="/" />,
            },
        ],
    },
]);

export function App() {
    return <RouterProvider router={router} />;
}
