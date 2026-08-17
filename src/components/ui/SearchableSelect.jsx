import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Reusable searchable select / combobox component.
 * Props:
 *   id          – HTML id for the trigger button
 *   value       – currently selected value (string)
 *   onChange    – (value: string) => void
 *   options     – [{ value, label }]
 *   placeholder – text shown when nothing selected
 *   disabled    – disables the control
 *   className   – extra class on the wrapper
 *   maxHeight   – tallest the dropdown panel may get, in px, before it scrolls
 */
export default function SearchableSelect({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  className = '',
  searchable = true,
  buttonClassName = '',
  optionClassName = 'text-gray-400',
  maxHeight = 260,
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect]   = useState(null);
  const wrapRef           = useRef(null);
  const inputRef          = useRef(null);
  const dropdownRef       = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = query.trim()
    ? options.filter((o) =>
        String(o.label).toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useLayoutEffect(() => {
    if (open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setRect({
        top: r.bottom + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
      });
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function onDown(e) {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  function handleSelect(opt) {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange('');
    setQuery('');
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`} style={{ userSelect: 'none' }}>
      {/* Trigger button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={buttonClassName || 'form-input bg-white w-full flex items-center justify-between gap-2 text-left'}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span
          className="truncate flex-1 uppercase"
          style={{ fontSize: '11px', color: '#000' }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <i
            className={`fas fa-chevron-${open ? 'up' : 'down'} text-gray-800`}
            style={{ fontSize: '10px' }}
          />
        </span>
      </button>

      {/* Dropdown panel */}
      {open && rect && createPortal(
        <div
          ref={dropdownRef}
          className="absolute z-[9999] bg-white border border-gray-500"
          style={{
            top: rect.top + 2,
            left: rect.left,
            // Exactly the trigger's width. It used to be max-content up to 90vw,
            // so one long option — "FIRE NOC RENEWAL / FORM B SUBMISSION (…)" —
            // stretched the panel past the right edge and gave the whole page a
            // horizontal scrollbar. Long labels wrap inside instead.
            width: rect.width,
            maxHeight: `${maxHeight}px`,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Search input */}
          {searchable && (
            <div className="p-2 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-1.5 border border-gray-300 rounded px-2 py-1 bg-gray-50">
                <i className="fas fa-search text-gray-400" style={{ fontSize: '11px' }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="flex-1 outline-none bg-transparent text-gray-700 uppercase"
                  style={{ fontSize: '12px', border: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div className="dropdown-scroll" style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-gray-400 text-center uppercase" style={{ fontSize: '12px' }}>
                No results found
              </div>
            ) : (
              filtered.map((opt, i) => (
                  <div
                    key={`${opt.value}__${i}`}
                    onClick={() => handleSelect(opt)}
                    className={`px-3 py-1.5 cursor-pointer uppercase break-words leading-snug ${optionClassName} hover:bg-[#007BFF] hover:text-white ${
                      String(opt.value) === String(value) ? 'font-semibold' : ''
                    }`}
                    style={{ fontSize: '11px' }}
                    title={opt.label}
                  >
                    {opt.label}
                  </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
