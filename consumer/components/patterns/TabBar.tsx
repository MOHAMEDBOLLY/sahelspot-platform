"use client";

type Tab = {
  id: string;
  label: string;
};

type TabBarProps = {
  tabs: readonly Tab[];
  activeId: string;
  onChange: (id: string) => void;
};

/** Segmented tab bar — first (and only, in v1) use is Saved's
 * Favorites / Collections / Want to go. Active = bold navy + underline;
 * inactive = grey. Full ARIA tab semantics since this is the first place in
 * the app that needs them. */
export function TabBar({ tabs, activeId, onChange }: TabBarProps) {
  return (
    <div aria-label="Saved lists" className="flex border-b border-outline-variant/20" role="tablist">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            aria-selected={active}
            className={`flex-1 border-b-2 px-2 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant"
            }`}
            id={`tab-${tab.id}`}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
