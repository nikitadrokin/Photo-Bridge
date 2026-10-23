import { cva } from 'class-variance-authority';

const codeVariants = cva('px-1 rounded-sm font-mono', {
  variants: {
    variant: {
      secondary: 'bg-secondary text-secondary-foreground',
      muted: 'bg-muted text-muted-foreground',
    },
    defaultVariants: {
      variant: 'secondary',
    },
  },
});

const Code = ({
  children,
  variant = 'secondary',
}: {
  children: React.ReactNode;
  variant?: 'secondary' | 'muted';
}) => {
  return <span className={codeVariants({ variant })}>{children}</span>;
};

export default Code;
export { codeVariants };
