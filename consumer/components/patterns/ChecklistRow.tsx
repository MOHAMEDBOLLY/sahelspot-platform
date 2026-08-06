import { Icon } from "@/components/ui/Icon";

type ChecklistRowProps = {
  text: string;
};

/** Venue Details "Why visit?" — teal-tinted circular check + text, read
 * directly from the Boca Beach export
 * (`w-5 h-5 rounded-full bg-brand-teal/10` + 16px teal `check`). */
export function ChecklistRow({ text }: ChecklistRowProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon className="text-primary" name="check" size={16} />
      </span>
      <p className="text-sm font-medium text-on-surface-variant">{text}</p>
    </div>
  );
}
