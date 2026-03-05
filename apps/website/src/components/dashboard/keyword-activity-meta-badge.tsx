export const KeywordActivityMetaBadge = (props: { label: string; value: string }) => {
    return (
        <div className="rounded border border-border/70 bg-background/70 px-2 py-1">
            <p className="text-[9px] text-muted-foreground uppercase tracking-[0.16em]">
                {props.label}
            </p>
            <p className="mt-0.5 font-medium text-[11px] text-foreground">{props.value}</p>
        </div>
    );
};
