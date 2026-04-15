'use client';

interface OneClickTagsProps {
  options: Array<{ label: string; value: string }>;
  onSelect: (value: string) => void;
  selected?: string;
}

export default function OneClickTags({ options, onSelect, selected }: OneClickTagsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            selected === option.value
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
