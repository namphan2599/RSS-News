import { DatePicker } from "./DatePicker";

export function SidebarDateControls({
  ariaLabel,
  label,
  onChange,
  onNext,
  onPrevious,
  value,
}: {
  ariaLabel: string;
  label: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  value: string;
}) {
  return (
    <div className="sidebar-date-controls" aria-label={ariaLabel}>
      <span className="sidebar-control-label">{label}</span>
      <DatePicker value={value} onChange={onChange} />
      <div className="sidebar-date-actions">
        <button type="button" onClick={onPrevious}>
          Previous
        </button>
        <button type="button" onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  );
}
