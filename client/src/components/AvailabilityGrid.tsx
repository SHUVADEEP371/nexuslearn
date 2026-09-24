import { PointerEvent, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../config/api';

interface Props { initialSlots?: number[]; disabled?: boolean; onSaved?: (slots: number[]) => void }
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hours = Array.from({ length: 24 }, (_, hour) => hour);

export default function AvailabilityGrid({ initialSlots = [], disabled = false, onSaved }: Props) {
  const [selected, setSelected] = useState(() => new Set(initialSlots.filter((slot) => Number.isInteger(slot) && slot >= 0 && slot < 168)));
  const [saving, setSaving] = useState(false);
  const pointerValue = useRef<boolean | null>(null);
  const visited = useRef(new Set<number>());

  useEffect(() => setSelected(new Set(initialSlots)), [initialSlots]);

  function setSlot(slot: number, value: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (value) next.add(slot); else next.delete(slot);
      return next;
    });
  }

  function begin(event: PointerEvent<HTMLButtonElement>, slot: number) {
    if (disabled || saving) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    visited.current.clear();
    pointerValue.current = !selected.has(slot);
    visited.current.add(slot);
    setSlot(slot, pointerValue.current);
  }

  function paint(slot: number) {
    if (pointerValue.current === null || visited.current.has(slot)) return;
    visited.current.add(slot);
    setSlot(slot, pointerValue.current);
  }

  async function save() {
    setSaving(true);
    try {
      const availableSlots = [...selected].sort((a, b) => a - b);
      await api.put('/users/availability', { availableSlots });
      onSaved?.(availableSlots);
      toast.success('Weekly availability saved');
    } catch (error) {
      toast.error('Could not save weekly availability');
    } finally { setSaving(false); }
  }

  return <section className="mt-5" aria-label="Weekly availability in UTC">
    <div className="mb-2 flex items-center justify-between gap-3">
      <div><h4 className="font-semibold text-[#0C0420]">Weekly time slots (UTC)</h4><p className="text-xs text-[#5D3C64]">Select hours when you can meet. Drag across cells to select several.</p></div>
      <button type="button" onClick={() => void save()} disabled={disabled || saving} className="rounded-lg bg-[#7B466A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save hours'}</button>
    </div>
    <div className="overflow-auto rounded-xl border border-[#7B466A]/40 bg-white touch-none" onPointerMove={(event) => {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot-index]');
      const slot = target?.dataset.slotIndex;
      if (slot !== undefined) paint(Number(slot));
    }}>
      <div className="min-w-[950px]">
        <div className="grid grid-cols-[100px_repeat(24,minmax(28px,1fr))] border-b bg-[#F8F1F6] text-center text-[10px] font-medium text-slate-600">
          <span className="sticky left-0 z-10 bg-[#F8F1F6] p-2 text-left">UTC day</span>
          {hours.map((hour) => <span key={hour} className="p-2">{String(hour).padStart(2, '0')}</span>)}
        </div>
        {days.map((day, dayIndex) => <div key={day} className="grid grid-cols-[100px_repeat(24,minmax(28px,1fr))] border-b last:border-0">
          <span className="sticky left-0 z-10 flex items-center bg-white px-2 text-xs font-medium text-slate-700">{day}</span>
          {hours.map((hour) => {
            const slot = dayIndex * 24 + hour;
            const active = selected.has(slot);
            return <button key={hour} type="button" aria-label={`${day} ${String(hour).padStart(2, '0')}:00 UTC`} aria-pressed={active} disabled={disabled || saving}
              data-slot-index={slot} onPointerDown={(event) => begin(event, slot)} onPointerUp={() => { pointerValue.current = null; }}
              className={`h-8 border-l border-slate-100 ${active ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-50 hover:bg-emerald-100'} disabled:cursor-not-allowed`} />;
          })}
        </div>)}
      </div>
    </div>
    <p className="mt-2 text-xs text-slate-500">{selected.size} of 168 hours selected. Matching compares UTC hour-of-week indices.</p>
  </section>;
}
