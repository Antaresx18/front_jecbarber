import { useRef } from 'react';

export default function AdminTabBar({ tabs, activeTab, setActiveTab }) {
  const btnRefs = useRef([]);

  const focusIndex = (i) => {
    requestAnimationFrame(() => btnRefs.current[i]?.focus());
  };

  const handleKeyDown = (e, index) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    e.preventDefault();
    const len = tabs.length;
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % len;
    if (e.key === 'ArrowLeft') next = (index - 1 + len) % len;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = len - 1;
    setActiveTab(tabs[next].id);
    focusIndex(next);
  };

  return (
    <div
      role="tablist"
      aria-label="Secciones del panel administrativo"
      className="flex bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/50 overflow-x-auto max-w-full gap-0.5"
    >
      {tabs.map((tab, index) => {
        const selected = activeTab === tab.id;
        const { Icon } = tab;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              btnRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`admin-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`admin-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all rounded-lg whitespace-nowrap shrink-0 ${
              selected
                ? 'bg-brand-gold text-brand-dark shadow-lg'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Icon size={16} aria-hidden />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
