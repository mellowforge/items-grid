import { type ReactElement, useEffect, useState } from 'react';

/** A shell command with a copy button. */
export function CopyCommand({ command }: { command: string }): ReactElement {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      // Clipboard access can be denied; the command stays selectable.
    }
  };

  return (
    <div className="copy-command">
      <code>
        <span className="prompt" aria-hidden="true">
          $
        </span>
        {command}
      </code>
      <button type="button" onClick={copy} aria-label={`Copy “${command}”`}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span className="visually-hidden" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </div>
  );
}
