import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  className,
}) => (
  <div
    className={cn(
      'rounded-xl border bg-muted/20 px-3 py-2.5 min-w-0',
      className,
    )}
  >
    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide truncate">
        {label}
      </span>
    </div>
    <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
      {value}
    </p>
  </div>
);

export default StatCard;
