import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';

interface ActionItemProps {
  icon: ReactNode;
  iconClass?: string;
  title: string;
  description: string;
  disabled?: boolean;
  children: ReactNode;
}

const ActionItem: React.FC<ActionItemProps> = ({
  icon,
  iconClass = 'text-primary',
  title,
  description,
  disabled = false,
  children,
}) => {
  return (
    <Item className={disabled ? 'opacity-50' : ''}>
      <ItemMedia className={iconClass}>{icon}</ItemMedia>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ItemActions>{children}</ItemActions>
    </Item>
  );
};

export default ActionItem;

// Re-export Button for convenience
export { Button };
