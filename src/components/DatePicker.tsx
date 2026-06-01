export function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="date-picker">
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
