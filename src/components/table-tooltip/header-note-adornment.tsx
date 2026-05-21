import { StickyNote } from "lucide-react";

export function HeaderNoteAdornment({ note }: { note?: string }) {
  if (!note) {
    return null;
  }

  return (
    <span className="inline-flex min-w-[1.25rem] shrink-0 items-center pl-1">
      <StickyNote size="1rem" />
    </span>
  );
}
