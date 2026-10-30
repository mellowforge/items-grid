import type { ReactElement } from 'react';

/** A labelled group of toggle buttons; the pressed one is the current value. */
export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
}): ReactElement {
  return (
    <span className="control">
      <span>{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            className="segmented__option"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </span>
  );
}
