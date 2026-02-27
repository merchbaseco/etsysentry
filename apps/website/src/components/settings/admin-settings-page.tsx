import { RefreshCw } from 'lucide-react';
import {
    sectionBarClassName,
    sectionBarLabelClassName,
    wideButtonClassName,
} from '@/components/settings/shared';
import { cn } from '@/lib/utils';

interface AdminSettingsPageProps {
    enqueueErrorMessage: string | null;
    enqueueMessage: string | null;
    isEnqueuingListingResync: boolean;
    onEnqueueListingResync: () => Promise<void>;
}

export const AdminSettingsPage = ({
    enqueueMessage,
    enqueueErrorMessage,
    isEnqueuingListingResync,
    onEnqueueListingResync,
}: AdminSettingsPageProps) => {
    return (
        <div>
            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Listing Operations</span>
            </div>

            <div className="px-4 py-2">
                <p className="text-muted-foreground text-xs">
                    Queue a full resync for all tracked listings in this tenant.
                </p>
            </div>

            <button
                className={cn(wideButtonClassName, 'border-t')}
                disabled={isEnqueuingListingResync}
                onClick={() => {
                    void onEnqueueListingResync();
                }}
                type="button"
            >
                <RefreshCw
                    className={cn('size-3', isEnqueuingListingResync ? 'animate-spin' : undefined)}
                />
                Enqueue Listing Resync
            </button>

            {enqueueMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-terminal-green text-xs">{enqueueMessage}</p>
                </div>
            ) : null}

            {enqueueErrorMessage ? (
                <div className="px-4 py-1.5">
                    <p className="text-terminal-red text-xs">{enqueueErrorMessage}</p>
                </div>
            ) : null}
        </div>
    );
};
