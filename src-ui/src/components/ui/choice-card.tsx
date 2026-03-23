import { useId } from 'react';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

/** One row in a {@link ChoiceCardRadioGroup}. */
export interface ChoiceCardOption<T extends string> {
  /** Value submitted with the radio group. */
  value: T;
  /** Primary line (e.g. action name). */
  title: string;
  /** Supporting copy under the title. */
  description: string;
}

export interface ChoiceCardRadioGroupProps<T extends string> {
  /** Visible group label (legend). */
  legend: string;
  /** Selected option value. */
  value: T;
  /** Called when the user selects a different option. */
  onValueChange: (next: T) => void;
  /** Choices to render as bordered cards with radios. */
  options: ReadonlyArray<ChoiceCardOption<T>>;
  /** Optional `name` for the underlying radio group. */
  name?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Radio group where each option is a horizontal field row with title, description, and radio — card chrome from `FieldLabel` + `Field`.
 */
export function ChoiceCardRadioGroup<T extends string>({
  legend,
  value,
  onValueChange,
  options,
  name,
  className,
  disabled,
}: ChoiceCardRadioGroupProps<T>) {
  const baseId = useId();

  return (
    <FieldSet className={cn('max-w-full gap-3', className)}>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <RadioGroup
        name={name}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (
            typeof next === 'string' &&
            options.some((o) => o.value === next)
          ) {
            onValueChange(next as T);
          }
        }}
        className="gap-2"
      >
        {options.map((option) => {
          const id = `${baseId}-${option.value}`;
          return (
            <FieldLabel key={option.value} htmlFor={id} className="w-full">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{option.title}</FieldTitle>
                  <FieldDescription>{option.description}</FieldDescription>
                </FieldContent>
                <RadioGroupItem value={option.value} id={id} />
              </Field>
            </FieldLabel>
          );
        })}
      </RadioGroup>
    </FieldSet>
  );
}
