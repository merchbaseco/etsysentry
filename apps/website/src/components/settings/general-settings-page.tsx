import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
    dataRowClassName,
    sectionBarClassName,
    sectionBarLabelClassName,
} from '@/components/settings/shared';
import { cn } from '@/lib/utils';

interface ThemeOption {
    icon: typeof Sun;
    id: 'light' | 'dark' | 'system';
    label: string;
}

const themeOptions: ThemeOption[] = [
    { icon: Sun, id: 'light', label: 'Light' },
    { icon: Moon, id: 'dark', label: 'Dark' },
    { icon: Monitor, id: 'system', label: 'System' },
];

export const GeneralSettingsPage = () => {
    const { theme, setTheme } = useTheme();

    return (
        <div>
            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>Theme</span>
            </div>

            <div className="grid grid-cols-3">
                {themeOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = theme === option.id;

                    return (
                        <button
                            className={cn(
                                'flex cursor-pointer flex-col items-center gap-1.5',
                                'border-border border-r px-3 py-3',
                                'text-[11px] transition-colors last:border-r-0',
                                isActive
                                    ? 'bg-primary/5 font-medium text-primary'
                                    : 'text-muted-foreground hover:bg-secondary/50',
                                isActive ? '' : 'hover:text-foreground'
                            )}
                            key={option.id}
                            onClick={() => setTheme(option.id)}
                            type="button"
                        >
                            <Icon className="size-4" />
                            <span className="uppercase tracking-wider">{option.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className={sectionBarClassName}>
                <span className={sectionBarLabelClassName}>About</span>
            </div>

            <div className={dataRowClassName}>
                <span className="text-[11px] text-muted-foreground">Version</span>
                <span className="font-medium text-[11px] text-foreground">0.1.1</span>
            </div>
        </div>
    );
};
