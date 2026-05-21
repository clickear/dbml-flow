export const GroupHeaderTooltipView = ({
  label,
  note,
}: {
  label: string;
  note: string;
}) => {
  return (
    <div className="flex flex-col gap-1 px-2 py-1 text-gray-100 text-xs">
      <div className="text-xs pb-0.5 whitespace-nowrap border-b-2 border-b-muted-foreground">
        <span>{label}</span>
      </div>
      <div className="text-muted-foreground">{note}</div>
    </div>
  );
};
