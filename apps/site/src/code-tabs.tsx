import { type KeyboardEvent, type ReactElement, useRef, useState } from 'react';

import { CopyCommand } from './copy-command';
import angularExample from './examples/angular.example.ts?raw';
import reactExample from './examples/react.example.tsx?raw';
import vanillaExample from './examples/vanilla.example.ts?raw';

const TABS = [
  {
    id: 'react',
    label: 'React',
    install: 'npm install @mellowforge/items-grid-core @mellowforge/items-grid-react',
    file: 'devices.tsx',
    code: reactExample,
  },
  {
    id: 'angular',
    label: 'Angular',
    install: 'npm install @mellowforge/items-grid-core @mellowforge/items-grid-angular',
    file: 'devices.ts',
    code: angularExample,
  },
  {
    id: 'vanilla',
    label: 'Vanilla',
    install: 'npm install @mellowforge/items-grid-core',
    file: 'devices.ts',
    code: vanillaExample,
  },
] as const;

/** Quick-start code for each framework, as an APG tabs widget (arrows, Home, End). */
export function CodeTabs(): ReactElement {
  const [selected, setSelected] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number): void => {
    const next = (index + TABS.length) % TABS.length;
    setSelected(next);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const moves: Record<string, number> = {
      ArrowRight: selected + 1,
      ArrowLeft: selected - 1,
      Home: 0,
      End: TABS.length - 1,
    };
    const target = moves[event.key];
    if (target !== undefined) {
      event.preventDefault();
      select(target);
    }
  };

  return (
    <div className="code-tabs">
      <div className="code-tablist" role="tablist" aria-label="Framework" onKeyDown={onKeyDown}>
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={element => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={index === selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={index === selected ? 0 : -1}
            onClick={() => setSelected(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {TABS.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={index !== selected}
          className="code-panel"
        >
          <CopyCommand command={tab.install} />
          <div className="code-file">{tab.file}</div>
          <pre tabIndex={0} aria-label={`${tab.label} example`}>
            <code>{tab.code.trim()}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
