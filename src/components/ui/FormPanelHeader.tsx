import { Button } from "@/components/ui/button";

export function FormPanelHeader({
  title,
  onCancel,
}: {
  title: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-medium text-foreground">{title}</h3>
      <Button type="button" variant="ghost" onClick={onCancel} className="shrink-0">
        Отмена
      </Button>
    </div>
  );
}
