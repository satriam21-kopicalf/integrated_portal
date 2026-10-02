'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClear: () => void;
}

export default function DateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasDateRange = dateFrom || dateTo;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    // Adjust for Monday start (ISO week)
    const adjustedStart = startingDay === 0 ? 6 : startingDay - 1;

    const days: (number | null)[] = [];
    for (let i = 0; i < adjustedStart; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleDateClick = (day: number) => {
    if (day === null) return;

    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateStr = formatDate(selectedDate);

    if (selecting === 'from') {
      onDateFromChange(dateStr);
      setSelecting('to');
    } else {
      onDateToChange(dateStr);
      setSelecting('from');
      setIsOpen(false);
    }
  };

  const isSelected = (day: number) => {
    if (day === null) return false;
    const dateStr = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    if (dateFrom && dateTo) {
      return dateStr >= dateFrom && dateStr <= dateTo;
    }
    if (dateFrom && dateStr === dateFrom) return true;
    if (dateTo && dateStr === dateTo) return true;
    return false;
  };

  const isRange = (day: number) => {
    if (day === null || !dateFrom || !dateTo) return false;
    const dateStr = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    return dateStr > dateFrom && dateStr < dateTo;
  };

  const isEdge = (day: number) => {
    if (day === null) return false;
    const dateStr = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    return dateStr === dateFrom || dateStr === dateTo;
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthName = currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const setQuickRange = (daysBack: number) => {
    const today = new Date();
    const past = new Date();
    past.setDate(past.getDate() - daysBack);
    onDateFromChange(formatDate(past));
    onDateToChange(formatDate(today));
    setSelecting('from');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
          hasDateRange
            ? 'bg-blue-50 border-blue-300 text-blue-700 hover:border-blue-400'
            : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-700'
        }`}
      >
        <Calendar size={16} />
        <span>
          {hasDateRange ? (
            <>
              {formatDisplayDate(dateFrom)} - {formatDisplayDate(dateTo)}
            </>
          ) : (
            'Select Date'
          )}
        </span>
        {hasDateRange && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ml-1 p-0.5 hover:bg-blue-100 rounded transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 w-[320px] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <button
                onClick={prevMonth}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={18} className="text-slate-600" />
              </button>
              <span className="font-semibold text-slate-900">{monthName}</span>
              <button
                onClick={nextMonth}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight size={18} className="text-slate-600" />
              </button>
            </div>
          </div>

          {/* Calendar */}
          <div className="p-4">
            {/* Week Days Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-[11px] font-medium text-slate-400 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => (
                <button
                  key={index}
                  onClick={() => handleDateClick(day!)}
                  disabled={day === null}
                  className={`
                    h-9 w-9 text-sm rounded-lg transition-all
                    ${day === null ? 'cursor-default' : ''}
                    ${day !== null && isSelected(day) ? 'bg-blue-600 text-white font-semibold shadow-sm' : ''}
                    ${day !== null && isRange(day) ? 'bg-blue-100 rounded-none' : ''}
                    ${day !== null && !isSelected(day) ? 'hover:bg-slate-100' : ''}
                    ${day !== null && isEdge(day) && !isSelected(day) ? 'bg-blue-50 font-medium' : ''}
                  `}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
            {/* Quick Select Buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setQuickRange(7)}
                className="flex-1 px-3 py-2 text-xs font-medium bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-all"
              >
                7 Hari
              </button>
              <button
                onClick={() => setQuickRange(30)}
                className="flex-1 px-3 py-2 text-xs font-medium bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-all"
              >
                30 Hari
              </button>
              <button
                onClick={() => setQuickRange(65)}
                className="flex-1 px-3 py-2 text-xs font-medium bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-all"
              >
                65 Hari
              </button>
            </div>

            {/* Selection Info */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {selecting === 'from' ? 'Pilih tanggal mulai' : 'Pilih tanggal akhir'}
              </span>
              <span>
                {dateFrom && (
                  <span className="text-slate-700 font-medium">
                    {formatDisplayDate(dateFrom)}
                    {dateTo && ` - ${formatDisplayDate(dateTo)}`}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
