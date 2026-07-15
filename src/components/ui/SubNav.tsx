export function SubNav<T extends string>({
  items,
  value,
  onChange,
}: {
  items: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="-mx-1 mb-5 flex gap-1 overflow-x-auto pb-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={
            value === item.id
              ? "shrink-0 rounded-full border border-brand bg-card px-4 py-2 text-sm font-medium text-brand shadow-sm"
              : "shrink-0 rounded-full border border-transparent px-4 py-2 text-sm text-muted transition-colors hover:border-border hover:bg-card hover:text-foreground"
          }
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
