export function CompositeRelationTooltipView({
  remoteTableName,
  fieldPairs,
}: {
  remoteTableName: string;
  fieldPairs: Array<{ local: string; remote: string }>;
}) {
  return (
    <div className="flex flex-col gap-1 px-2 py-1 text-gray-100 text-xs">
      <div className="text-xs pb-0.5 whitespace-nowrap border-b-2 border-b-muted-foreground">
        Composite FK -&gt; {remoteTableName}
      </div>
      {fieldPairs.map((pair) => (
        <div key={`${pair.local}-${pair.remote}`}>
          {pair.local} -&gt; {pair.remote}
        </div>
      ))}
    </div>
  );
}
