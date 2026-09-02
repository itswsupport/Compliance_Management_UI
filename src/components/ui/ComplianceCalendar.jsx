import { useMemo, useState, useEffect } from 'react';
import { getDueDate } from '../../utils/formatters';

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const PALETTE = [
  '#e8112d', '#f5a623', '#7b1a1a', '#22b14c',
  '#0a84ff', '#8b2be2', '#00a6a6', '#d6337f',
];

// Entries listed inside a day cell before it collapses to a "+n more" line.
const MAX_ENTRIES = 3;

/**
 * Parse a due date coming from the API. Accepts YYYY-MM-DD (what the assign form
 * posts) and falls back to DD-MM-YYYY / DD-MM-YY separated by - or /.
 * Returns { y, m, d } (m is 0-based) or null.
 */
function parseDueDate(value) {
  if (!value || typeof value !== 'string') return null;
  const s = value.trim().split(/[ T]/)[0];
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) return { y: +m[1], m: +m[2] - 1, d: +m[3] };
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  if (m) return { y: +m[3], m: +m[2] - 1, d: +m[1] };
  return null;
}

const dayKey = (y, m, d) => `${y}-${m}-${d}`;

/**
 * Legal notices share this calendar with compliances and are drawn in red so
 * the two are told apart at a glance. The flag is set by whoever maps a notice
 * into a calendar row; a compliance never carries it.
 */
const LEGAL_RED = '#df4759';
const isLegal = (row) => Boolean(row?.isLegalNotice);
export default function ComplianceCalendar({
  data = [],
  onSelect,
  loading = false,
  focusYear = '',
  focusMonth = '',
}) {
  const now = new Date();
  const [cursor, setCursor] = useState({
    year: focusYear === '' ? now.getFullYear() : Number(focusYear),
    month: focusMonth === '' ? now.getMonth() : Number(focusMonth),
  });
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    if (focusYear === '' && focusMonth === '') return;
    setCursor((prev) => ({
      year: focusYear === '' ? prev.year : Number(focusYear),
      month: focusMonth === '' ? prev.month : Number(focusMonth),
    }));
    setSelectedKey(null);
  }, [focusYear, focusMonth]);

  const colorOf = useMemo(() => {
    const types = [...new Set(data.map((r) => r.compActType).filter(Boolean))].sort();
    const map = {};
    types.forEach((t, i) => { map[t] = PALETTE[i % PALETTE.length]; });
    return map;
  }, [data]);

  const byDay = useMemo(() => {
    const map = new Map();
    data.forEach((row) => {
      const parsed = parseDueDate(getDueDate(row));
      if (!parsed) return;
      const key = dayKey(parsed.y, parsed.m, parsed.d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }, [data]);

  const { year, month } = cursor;
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((firstDow + daysInMonth) / 7) * 7;

  const todayKey = dayKey(now.getFullYear(), now.getMonth(), now.getDate());
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const shiftMonth = (delta) => {
    const next = new Date(year, month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
    setSelectedKey(null);
  };

  const goToday = () => {
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedKey(null);
  };

  // Acts due in the visible month — drives the legend.
  const monthActs = useMemo(() => {
    const acts = new Set();
    for (let d = 1; d <= daysInMonth; d += 1) {
      (byDay.get(dayKey(year, month, d)) || []).forEach((row) => {
        if (row.compActType) acts.add(row.compActType);
      });
    }
    return [...acts].sort();
  }, [byDay, year, month, daysInMonth]);

  const monthTotal = useMemo(() => {
    let n = 0;
    for (let d = 1; d <= daysInMonth; d += 1) n += (byDay.get(dayKey(year, month, d)) || []).length;
    return n;
  }, [byDay, year, month, daysInMonth]);

  const selectedRows = selectedKey ? byDay.get(selectedKey) || [] : [];
  const selectedDay = selectedKey ? Number(selectedKey.split('-')[2]) : null;

  return (
    <div className="card no-print">
      <div className="card-header-primary flex items-center justify-between">
        <h3>
          <i className="fas fa-calendar-alt" /> Compliance Calendar
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            title="Previous month"
            className="w-6 h-6 flex items-center justify-center rounded-sm text-white hover:bg-white/20 cursor-pointer"
          >
            <i className="fas fa-chevron-left text-[11px]" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            title="Next month"
            className="w-6 h-6 flex items-center justify-center rounded-sm text-white hover:bg-white/20 cursor-pointer"
          >
            <i className="fas fa-chevron-right text-[11px]" />
          </button>
        </div>
      </div>

      <div className="p-4 md:p-5">
        {/* Month / year strip */}
        <div className="flex items-baseline justify-between mb-2 px-0.5">
          <div className="text-[15px] font-bold text-[#3482AE] tracking-wide">
            {MONTHS[month]} <span className="text-gray-500 font-semibold">{year}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500">
              {monthTotal} DUE
            </span>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={goToday}
                className="text-[11px] text-[#3482AE] underline cursor-pointer"
              >
                TODAY
              </button>
            )}
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-px">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className={`text-center text-[11px] font-semibold text-white py-1.5 tracking-wide ${
                wd === 'SUN' ? 'bg-[#c2478a]' : 'bg-[#7ec8d4]'
              }`}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200">
          {Array.from({ length: cellCount }).map((_, i) => {
            const dayNum = i - firstDow + 1;
            const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
            if (!inMonth) {
              return <div key={i} className="bg-gray-50 min-h-[92px]" />;
            }
            const key = dayKey(year, month, dayNum);
            const events = byDay.get(key) || [];
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            const isSunday = i % 7 === 0;
            return (
              <button
                key={i}
                type="button"
                disabled={events.length === 0}
                onClick={() => setSelectedKey(isSelected ? null : key)}
                title={
                  events.length
                    ? events.map((r) => `${r.compSrNo} — ${r.compActType || ''}`).join('\n')
                    : undefined
                }
                className={`min-h-[92px] w-full p-1.5 flex flex-col items-stretch gap-1 text-left align-top transition-colors ${
                  events.length ? 'cursor-pointer hover:bg-[#eaf2f8]' : 'cursor-default'
                } ${isSelected ? 'bg-[#dceaf4]' : 'bg-white'}`}
              >
                <span
                  className={`text-[12px] leading-none w-[21px] h-[21px] flex items-center justify-center rounded-full shrink-0 ${
                    isToday
                      ? 'bg-[#3482AE] text-white font-bold'
                      : isSunday
                      ? 'text-[#c2478a] font-bold'
                      : 'text-gray-700 font-bold'
                  }`}
                >
                  {dayNum}
                </span>
                {events.length > 0 && (
                  <span className="flex flex-col gap-[3px] min-w-0">
                    {events.slice(0, MAX_ENTRIES).map((row, k) => (
                      <span key={`${row.id}-${k}`} className="flex items-center gap-1 min-w-0">
                        <span
                          className="w-[7px] h-[7px] rounded-full shrink-0"
                          style={{ backgroundColor: isLegal(row) ? LEGAL_RED : (colorOf[row.compActType] || '#9ca3af') }}
                        />
                        <span
                          className={`text-[10px] leading-tight truncate ${isLegal(row) ? 'font-bold' : 'text-gray-700'}`}
                          style={isLegal(row) ? { color: LEGAL_RED } : undefined}
                        >
                          {row.compActType || row.compSrNo}
                        </span>
                      </span>
                    ))}
                    {events.length > MAX_ENTRIES && (
                      <span className="text-[10px] leading-tight text-gray-500 font-semibold pl-[11px]">
                        +{events.length - MAX_ENTRIES} MORE
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="text-[11px] text-gray-400 text-center pt-2">LOADING COMPLIANCES…</div>
        )}

        {/* Selected day detail */}
        {selectedRows.length > 0 && (
          <div className="mt-3 border-t border-gray-200 pt-2">
            <div className="text-[11px] font-semibold text-gray-600 mb-1.5">
              {MONTHS[month]} {selectedDay}, {year} — {selectedRows.length} COMPLIANCE
              {selectedRows.length > 1 ? 'S' : ''} DUE
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1 max-h-[220px] overflow-y-auto pr-1">
              {selectedRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelect?.(row.id)}
                  className="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-sm bg-gray-50 hover:bg-[#eaf2f8] cursor-pointer"
                >
                  <span
                    className="w-[7px] h-[7px] rounded-full mt-[5px] shrink-0"
                    style={{ backgroundColor: isLegal(row) ? LEGAL_RED : (colorOf[row.compActType] || '#9ca3af') }}
                  />
                  <span className="min-w-0">
                    <span
                      className="block text-[11px] font-semibold"
                      style={{ color: isLegal(row) ? LEGAL_RED : '#3482AE' }}
                    >
                      {row.compSrNo}
                      {row.plantCode ? ` · ${row.plantCode}` : ''}
                    </span>
                    <span
                      className="block text-[11px] truncate"
                      style={{ color: isLegal(row) ? LEGAL_RED : undefined }}
                    >
                      {row.compActType || '-'}
                      {row.compActSubType ? ` — ${row.compActSubType}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Legend — acts falling in the visible month */}
        {monthActs.length > 0 && (
          <div className="mt-3 border-t border-gray-200 pt-2 flex flex-wrap gap-x-3 gap-y-1">
            {monthActs.map((act) => (
              <span key={act} className="flex items-center gap-1.5">
                <span
                  className="w-[9px] h-[9px] rounded-sm"
                  style={{ backgroundColor: colorOf[act] || '#9ca3af' }}
                />
                <span className="text-[10px] font-semibold text-gray-600 uppercase">{act}</span>
              </span>
            ))}
          </div>
        )}

        {!loading && monthTotal === 0 && (
          <div className="text-[11px] text-gray-400 text-center pt-3">
            NO COMPLIANCE DUE THIS MONTH
          </div>
        )}
      </div>
    </div>
  );
}
