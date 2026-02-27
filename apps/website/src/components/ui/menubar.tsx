'use client';

import {
    CheckboxItem,
    Content,
    Group,
    Item,
    ItemIndicator,
    Label,
    Menu,
    Portal,
    RadioGroup,
    RadioItem,
    Root,
    Separator,
    Sub,
    SubContent,
    SubTrigger,
    Trigger,
} from '@radix-ui/react-menubar';
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

function Menubar({ className, ...props }: ComponentProps<typeof Root>) {
    return (
        <Root
            className={cn(
                'flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs',
                className
            )}
            data-slot="menubar"
            {...props}
        />
    );
}

function MenubarMenu({ ...props }: ComponentProps<typeof Menu>) {
    return <Menu data-slot="menubar-menu" {...props} />;
}

function MenubarGroup({ ...props }: ComponentProps<typeof Group>) {
    return <Group data-slot="menubar-group" {...props} />;
}

function MenubarPortal({ ...props }: ComponentProps<typeof Portal>) {
    return <Portal data-slot="menubar-portal" {...props} />;
}

function MenubarRadioGroup({ ...props }: ComponentProps<typeof RadioGroup>) {
    return <RadioGroup data-slot="menubar-radio-group" {...props} />;
}

function MenubarTrigger({ className, ...props }: ComponentProps<typeof Trigger>) {
    return (
        <Trigger
            className={cn(
                'flex select-none items-center rounded-sm px-2 py-1 font-medium text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
                className
            )}
            data-slot="menubar-trigger"
            {...props}
        />
    );
}

function MenubarContent({
    className,
    align = 'start',
    alignOffset = -4,
    sideOffset = 8,
    ...props
}: ComponentProps<typeof Content>) {
    return (
        <MenubarPortal>
            <Content
                align={align}
                alignOffset={alignOffset}
                className={cn(
                    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[12rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in',
                    className
                )}
                data-slot="menubar-content"
                sideOffset={sideOffset}
                {...props}
            />
        </MenubarPortal>
    );
}

function MenubarItem({
    className,
    inset,
    variant = 'default',
    ...props
}: ComponentProps<typeof Item> & {
    inset?: boolean;
    variant?: 'default' | 'destructive';
}) {
    return (
        <Item
            className={cn(
                "data-[variant=destructive]:*:[svg]:!text-destructive relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[disabled]:opacity-50 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
                className
            )}
            data-inset={inset}
            data-slot="menubar-item"
            data-variant={variant}
            {...props}
        />
    );
}

function MenubarCheckboxItem({
    className,
    children,
    checked,
    ...props
}: ComponentProps<typeof CheckboxItem>) {
    return (
        <CheckboxItem
            checked={checked}
            className={cn(
                "relative flex cursor-default select-none items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                className
            )}
            data-slot="menubar-checkbox-item"
            {...props}
        >
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                <ItemIndicator>
                    <CheckIcon className="size-4" />
                </ItemIndicator>
            </span>
            {children}
        </CheckboxItem>
    );
}

function MenubarRadioItem({ className, children, ...props }: ComponentProps<typeof RadioItem>) {
    return (
        <RadioItem
            className={cn(
                "relative flex cursor-default select-none items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                className
            )}
            data-slot="menubar-radio-item"
            {...props}
        >
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                <ItemIndicator>
                    <CircleIcon className="size-2 fill-current" />
                </ItemIndicator>
            </span>
            {children}
        </RadioItem>
    );
}

function MenubarLabel({
    className,
    inset,
    ...props
}: ComponentProps<typeof Label> & {
    inset?: boolean;
}) {
    return (
        <Label
            className={cn('px-2 py-1.5 font-medium text-sm data-[inset]:pl-8', className)}
            data-inset={inset}
            data-slot="menubar-label"
            {...props}
        />
    );
}

function MenubarSeparator({ className, ...props }: ComponentProps<typeof Separator>) {
    return (
        <Separator
            className={cn('-mx-1 my-1 h-px bg-border', className)}
            data-slot="menubar-separator"
            {...props}
        />
    );
}

function MenubarShortcut({ className, ...props }: ComponentProps<'span'>) {
    return (
        <span
            className={cn('ml-auto text-muted-foreground text-xs tracking-widest', className)}
            data-slot="menubar-shortcut"
            {...props}
        />
    );
}

function MenubarSub({ ...props }: ComponentProps<typeof Sub>) {
    return <Sub data-slot="menubar-sub" {...props} />;
}

function MenubarSubTrigger({
    className,
    inset,
    children,
    ...props
}: ComponentProps<typeof SubTrigger> & {
    inset?: boolean;
}) {
    return (
        <SubTrigger
            className={cn(
                'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[inset]:pl-8 data-[state=open]:text-accent-foreground',
                className
            )}
            data-inset={inset}
            data-slot="menubar-sub-trigger"
            {...props}
        >
            {children}
            <ChevronRightIcon className="ml-auto h-4 w-4" />
        </SubTrigger>
    );
}

function MenubarSubContent({ className, ...props }: ComponentProps<typeof SubContent>) {
    return (
        <SubContent
            className={cn(
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=closed]:animate-out data-[state=open]:animate-in',
                className
            )}
            data-slot="menubar-sub-content"
            {...props}
        />
    );
}

export {
    Menubar,
    MenubarPortal,
    MenubarMenu,
    MenubarTrigger,
    MenubarContent,
    MenubarGroup,
    MenubarSeparator,
    MenubarLabel,
    MenubarItem,
    MenubarShortcut,
    MenubarCheckboxItem,
    MenubarRadioGroup,
    MenubarRadioItem,
    MenubarSub,
    MenubarSubTrigger,
    MenubarSubContent,
};
