import { X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface PathListProps {
  paths: Array<string>;
  maxVisible?: number;
  onClear?: () => void;
}

const PathList: React.FC<PathListProps> = ({
  paths,
  maxVisible = 5,
  onClear,
}) => {
  if (paths.length === 0) return null;

  return (
    <div className="text-sm text-muted-foreground">
      <div className="flex items-center justify-between mb-2">
        <p>Selected {paths.length} item(s):</p>
        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-6 px-2 text-xs"
          >
            <X data-icon="inline-start" weight="bold" />
            Clear
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {paths.slice(0, maxVisible).map((p) => (
          <code
            key={p}
            className="bg-muted px-2 py-1 rounded text-xs break-all"
          >
            {p}
          </code>
        ))}
        {paths.length > maxVisible && (
          <span className="text-xs">
            ...and {paths.length - maxVisible} more
          </span>
        )}
      </div>
    </div>
  );
};

export default PathList;
