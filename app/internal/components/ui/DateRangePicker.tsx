'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { Box, IconButton, Popover, Typography, TextField, InputAdornment, InputLabel, styled } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { useUserPreferences } from '../providers/UserPreferencesProvider';
import {
    formatDisplayDate,
    parseDisplayDate,
    autoFormatDateInput,
    getDatePlaceholder,
} from '../../lib/formatPreferences';

const StyledTextField = styled(TextField, {
    shouldForwardProp: (prop) => prop !== 'nopadding',
})<{ nopadding?: boolean }>(({ theme, error, nopadding }) => ({
    paddingBottom: nopadding ? '0px' : '0px',
    fontSize: '0.875rem',

    '& .MuiInputLabel-root': {
        display: 'none',
    },
    '& .MuiOutlinedInput-root': {
        backgroundColor: '#fafafa',
        borderRadius: '6px',
        fontSize: '14px',
        '& fieldset': {
            borderWidth: '1px',
            borderColor: error ? '#d32f2f' : 'rgba(0, 0, 0, 0.23)',
        },
        '&:hover fieldset': {
            borderColor: error ? '#d32f2f' : 'rgba(0, 0, 0, 0.4)',
        },
        '&.Mui-focused fieldset': {
            borderWidth: '1px',
            borderColor: error ? '#d32f2f' : theme.palette.primary.main,
        },
        '& .MuiInputAdornment-positionStart': {
            marginRight: '8px',
        },
    },
    '& .MuiInputAdornment-root': {
        backgroundColor: 'transparent',
    },
    '& .MuiFormHelperText-root': {
        color: error ? '#d32f2f' : '#666',
        marginLeft: 0,
        marginTop: '4px',
        fontSize: '12px',
    },
    '& .MuiInputBase-input': {
        backgroundColor: 'transparent',
        borderRadius: 'inherit',
        padding: '8.5px 14px',
    },
}));

export interface DateRangePickerProps {
    startDate?: Date | null;
    endDate?: Date | null;
    onChange?: (startDate: Date | null, endDate: Date | null) => void;
    placeholder?: string;
    label?: string;
    labelPosition?: 'top' | 'default';
    required?: boolean;
    error?: boolean;
    helperText?: string;
    disabled?: boolean;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    clearable?: boolean;
    nopadding?: boolean;
    filterinput?: boolean;
    id?: string;
    months?: number;
}

export function DateRangePicker({
    startDate: initialStartDate = null,
    endDate: initialEndDate = null,
    onChange,
    placeholder = 'Selecionar período',
    label,
    labelPosition = 'default',
    required = false,
    error = false,
    helperText,
    disabled = false,
    startAdornment,
    endAdornment,
    clearable = true,
    nopadding = false,
    filterinput = false,
    id,
    months = 1,
}: DateRangePickerProps) {
    const { preferences } = useUserPreferences();
    const dateFormat = preferences.dateFormat;

    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [startDate, setStartDate] = useState<Date | null>(initialStartDate);
    const [endDate, setEndDate] = useState<Date | null>(initialEndDate);
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    const anchorRef = useRef<HTMLDivElement>(null);
    const generatedId = useId();
    const inputId = id || generatedId;
    const [isEditing, setIsEditing] = useState(false);
    const [inputText, setInputText] = useState('');
    const [pickerMode, setPickerMode] = useState<'day' | 'month' | 'year'>('day');
    const [activeMonthIndex, setActiveMonthIndex] = useState(0);
    const yearPickerRef = useRef<HTMLDivElement>(null);
    const selectedYearRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setStartDate(initialStartDate);
        setEndDate(initialEndDate);
    }, [initialStartDate, initialEndDate]);

    // Auto-scroll to selected year when year picker opens
    useEffect(() => {
        if (pickerMode === 'year' && selectedYearRef.current && yearPickerRef.current) {
            const container = yearPickerRef.current;
            const selectedElement = selectedYearRef.current;
            const containerHeight = container.clientHeight;
            const elementTop = selectedElement.offsetTop;
            const elementHeight = selectedElement.clientHeight;

            // Scroll to center the selected year in the viewport
            container.scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
        }
    }, [pickerMode]);

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        return { daysInMonth, startingDayOfWeek };
    };

    const isSameDay = (date1: Date | null, date2: Date | null) => {
        if (!date1 || !date2) return false;
        return date1.getDate() === date2.getDate() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getFullYear() === date2.getFullYear();
    };

    const isDateInRange = (date: Date) => {
        if (!startDate) return false;
        const compareDate = endDate || hoverDate;
        if (!compareDate) return false;

        const start = startDate < compareDate ? startDate : compareDate;
        const end = startDate < compareDate ? compareDate : startDate;

        return date >= start && date <= end;
    };

    const isDateRangeEnd = (date: Date) => {
        return isSameDay(date, startDate) || isSameDay(date, endDate);
    };

    const handleDateClick = (day: number, monthDate: Date) => {
        const selectedDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);

        if (!startDate || (startDate && endDate)) {
            // Start new selection
            setStartDate(selectedDate);
            setEndDate(null);
        } else {
            // Complete the range
            if (selectedDate < startDate) {
                setEndDate(startDate);
                setStartDate(selectedDate);
            } else {
                setEndDate(selectedDate);
            }
            if (onChange) {
                const newStart = selectedDate < startDate ? selectedDate : startDate;
                const newEnd = selectedDate < startDate ? startDate : selectedDate;
                onChange(newStart, newEnd);
            }
        }
    };

    const handlePreviousMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const handleToday = () => {
        const today = new Date();
        setCurrentMonth(today);
        setStartDate(today);
        setEndDate(today);
        if (onChange) {
            onChange(today, today);
        }
    };

    const handleWeek = () => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (6 - dayOfWeek));

        setCurrentMonth(today);
        setStartDate(startOfWeek);
        setEndDate(endOfWeek);
        if (onChange) {
            onChange(startOfWeek, endOfWeek);
        }
    };

    const handleMonth = () => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        setCurrentMonth(today);
        setStartDate(startOfMonth);
        setEndDate(endOfMonth);
        if (onChange) {
            onChange(startOfMonth, endOfMonth);
        }
    };

    const handleYear = () => {
        const today = new Date();
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        const endOfYear = new Date(today.getFullYear(), 11, 31);

        setCurrentMonth(today);
        setStartDate(startOfYear);
        setEndDate(endOfYear);
        if (onChange) {
            onChange(startOfYear, endOfYear);
        }
    };

    const handleClear = () => {
        setStartDate(null);
        setEndDate(null);
        if (onChange) {
            onChange(null, null);
        }
    };

    // ── Typing support ────────────────────────────────────────────────────────

    const handleFocus = () => {
        if (disabled) return;
        setInputText(formatDateRange());
        setIsEditing(true);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 16);
        const d1 = digits.slice(0, 8);
        const d2 = digits.slice(8);
        let result = autoFormatDateInput(d1, dateFormat);
        if (d1.length === 8) {
            result += ' até ';
            if (d2.length > 0) result += autoFormatDateInput(d2, dateFormat);
        }
        setInputText(result);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (!inputText.trim()) {
            handleClear();
            return;
        }
        const parts = inputText.split(' até ');
        const newStart = parseDisplayDate(parts[0]?.trim(), dateFormat);
        const newEnd = parts[1] ? parseDisplayDate(parts[1].trim(), dateFormat) : null;
        if (newStart) {
            setStartDate(newStart);
            setCurrentMonth(newStart);
            setEndDate(newEnd);
            onChange?.(newStart, newEnd);
        }
    };

    const formatDateRange = () => {
        if (!startDate) return '';

        if (!endDate) {
            return formatDisplayDate(startDate, dateFormat);
        }

        return `${formatDisplayDate(startDate, dateFormat)} até ${formatDisplayDate(endDate, dateFormat)}`;
    };

    const renderCalendar = (monthDate: Date) => {
        const { daysInMonth, startingDayOfWeek } = getDaysInMonth(monthDate);
        const days = [];

        // Empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(
                <Box
                    key={`empty-${i}`}
                    sx={{
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                />
            );
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
            const isStart = isSameDay(date, startDate);
            const isEnd = isSameDay(date, endDate);
            const isInRange = isDateInRange(date);
            const isToday = isSameDay(date, new Date());

            // Determine the actual chronological start and end of the range
            const compareDate = endDate || hoverDate;
            const actualStart = startDate && compareDate && startDate > compareDate ? compareDate : startDate;
            const actualEnd = startDate && compareDate && startDate > compareDate ? startDate : compareDate;
            const isActualStart = isSameDay(date, actualStart);
            const isActualEnd = isSameDay(date, actualEnd);

            // Check if this is the first or last day of the week for border radius
            const dayOfWeek = (startingDayOfWeek + day - 1) % 7;
            const isFirstInWeek = dayOfWeek === 0;
            const isLastInWeek = dayOfWeek === 6;

            // Determine if previous/next day is in range for border radius
            const prevDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day - 1);
            const nextDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day + 1);
            const isPrevInRange = isDateInRange(prevDate);
            const isNextInRange = isDateInRange(nextDate);

            // Calculate border radius for the background - with rounded corners at row start/end
            let borderRadius = '0';
            if (isActualStart || isActualEnd || isInRange) {
                const isRangeStart = isActualStart || (isFirstInWeek && isInRange);
                const isRangeEnd = isActualEnd || (isLastInWeek && isInRange);

                if (isRangeStart && isRangeEnd) {
                    borderRadius = '50%';
                } else if (isRangeStart) {
                    borderRadius = '50% 0 0 50%';
                } else if (isRangeEnd) {
                    borderRadius = '0 50% 50% 0';
                }
            }

            days.push(
                <Box
                    key={day}
                    onClick={() => handleDateClick(day, monthDate)}
                    onMouseEnter={() => startDate && !endDate && setHoverDate(date)}
                    sx={{
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        mt: 0.5,
                        justifyContent: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                        backgroundColor: (isInRange || isStart || isEnd) ? 'primary.light' : 'transparent',
                        borderRadius: borderRadius,
                        '&:hover': {
                            '& > div': {
                                backgroundColor: isStart || isEnd ? 'primary.dark' : 'action.hover',
                            },
                        },
                    }}
                >
                    <Box
                        sx={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: (isStart || isEnd) ? 'primary.main' : 'transparent',
                            color: (isStart || isEnd) ? '#fff' : isToday ? 'primary.main' : 'text.primary',
                            fontWeight: (isStart || isEnd || isToday) ? 600 : 400,
                            fontSize: '14px',
                            transition: 'background-color 0.2s',
                        }}
                    >
                        {day}
                    </Box>
                </Box>
            );
        }

        return days;
    };

    // Generate year options (current year ± 50 years)
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 50;
    const endYear = currentYear + 50;

    const renderYearPicker = (monthDate: Date, monthIndex: number) => {
        const years: number[] = [];
        for (let y = startYear; y <= endYear; y++) {
            years.push(y);
        }
        return (
            <Box ref={yearPickerRef} sx={{ maxHeight: 280, overflowY: 'auto', px: 1 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                    {years.map((year) => {
                        const isCurrentYear = year === monthDate.getFullYear();
                        return (
                            <Box
                                key={year}
                                ref={isCurrentYear ? selectedYearRef : null}
                                onClick={() => {
                                    const newMonth = new Date(year, monthDate.getMonth(), 1);
                                    if (monthIndex === 0) {
                                        setCurrentMonth(newMonth);
                                    }
                                    setPickerMode('day');
                                }}
                                sx={{
                                    py: 1.5,
                                    px: 1,
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                    backgroundColor: isCurrentYear ? 'primary.main' : 'transparent',
                                    color: isCurrentYear ? '#fff' : 'text.primary',
                                    fontWeight: isCurrentYear ? 600 : 400,
                                    fontSize: '14px',
                                    '&:hover': {
                                        backgroundColor: isCurrentYear ? 'primary.dark' : 'action.hover',
                                    },
                                }}
                            >
                                {year}
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        );
    };

    const renderMonthPicker = (monthDate: Date, monthIndex: number) => {
        return (
            <Box sx={{ px: 2, py: 1 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                    {monthNames.map((month, idx) => (
                        <Box
                            key={idx}
                            onClick={() => {
                                const newMonth = new Date(monthDate.getFullYear(), idx, 1);
                                if (monthIndex === 0) {
                                    setCurrentMonth(newMonth);
                                }
                                setPickerMode('day');
                            }}
                            sx={{
                                py: 1.5,
                                px: 1,
                                textAlign: 'center',
                                cursor: 'pointer',
                                borderRadius: '8px',
                                backgroundColor: idx === monthDate.getMonth() ? 'primary.main' : 'transparent',
                                color: idx === monthDate.getMonth() ? '#fff' : 'text.primary',
                                fontWeight: idx === monthDate.getMonth() ? 600 : 400,
                                fontSize: '14px',
                                '&:hover': {
                                    backgroundColor: idx === monthDate.getMonth() ? 'primary.dark' : 'action.hover',
                                },
                            }}
                        >
                            {month}
                        </Box>
                    ))}
                </Box>
            </Box>
        );
    };

    const showClearButton = clearable && formatDateRange();

    const clearAdornment = showClearButton ? (
        <InputAdornment position="end">
            <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
                disabled={disabled}
                sx={{ padding: '4px', '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' } }}
            >
                <CloseIcon sx={{ fontSize: '18px' }} />
            </IconButton>
        </InputAdornment>
    ) : null;

    const calendarAdornment = (
        <InputAdornment position="start">
            <CalendarTodayIcon
                onClick={(e) => { e.stopPropagation(); if (!disabled) setIsOpen((o) => !o); }}
                sx={{ fontSize: '20px', color: error ? '#D32F2F' : (theme) => theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main, cursor: 'pointer' }}
            />
        </InputAdornment>
    );

    const inputPropsWithAdornments = {
        ...(startAdornment || calendarAdornment ? { startAdornment: startAdornment || calendarAdornment } : {}),
        ...(endAdornment || clearAdornment ? {
            endAdornment: (<>{endAdornment}{clearAdornment}</>)
        } : {}),
    };

    const textFieldContent = (
        <StyledTextField
            fullWidth
            value={isEditing ? inputText : formatDateRange()}
            placeholder={placeholder}
            onChange={handleTextChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            size="small"
            disabled={disabled}
            error={error}
            required={required}
            helperText={filterinput ? undefined : helperText || undefined}
            nopadding={nopadding}
            id={inputId}
            label={labelPosition === 'default' ? label : undefined}
            slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { suppressHydrationWarning: true },
                input: inputPropsWithAdornments,
                formHelperText: { suppressHydrationWarning: true },
            }}
        />
    );

    // Shared calendar popover (portal-based, no overflow clipping)
    const calendarPopover = (
        <Popover
            open={isOpen && !disabled}
            anchorEl={anchorRef.current}
            onClose={() => {
                setIsOpen(false);
                setPickerMode('day');
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{ paper: { elevation: 8, sx: { padding: 2, minWidth: months === 1 ? 320 : months * 310 } } }}
            disableAutoFocus
            disableEnforceFocus
        >
            {/* Month panels */}
            <Box sx={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: months }).map((_, i) => {
                    const monthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + i);
                    return (
                        <Box key={i} sx={{ flex: 1, minWidth: 0 }}>
                            {/* Header */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 0.5 }}>
                                {i === 0 && pickerMode === 'day' ? (
                                    <IconButton size="small" onClick={handlePreviousMonth}>
                                        <ChevronLeftIcon />
                                    </IconButton>
                                ) : <Box sx={{ width: 34 }} />}
                                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                    <Typography
                                        variant="subtitle1"
                                        fontWeight={600}
                                        onClick={() => {
                                            setActiveMonthIndex(i);
                                            setPickerMode(pickerMode === 'month' ? 'day' : 'month');
                                        }}
                                        sx={{
                                            cursor: 'pointer',
                                            px: 1,
                                            py: 0.5,
                                            borderRadius: '4px',
                                            '&:hover': { backgroundColor: 'action.hover' },
                                        }}
                                    >
                                        {monthNames[monthDate.getMonth()]}
                                    </Typography>
                                    <Typography
                                        variant="subtitle1"
                                        fontWeight={600}
                                        onClick={() => {
                                            setActiveMonthIndex(i);
                                            setPickerMode(pickerMode === 'year' ? 'day' : 'year');
                                        }}
                                        sx={{
                                            cursor: 'pointer',
                                            px: 1,
                                            py: 0.5,
                                            borderRadius: '4px',
                                            '&:hover': { backgroundColor: 'action.hover' },
                                        }}
                                    >
                                        {monthDate.getFullYear()}
                                    </Typography>
                                </Box>
                                {i === months - 1 && pickerMode === 'day' ? (
                                    <IconButton size="small" onClick={handleNextMonth}>
                                        <ChevronRightIcon />
                                    </IconButton>
                                ) : <Box sx={{ width: 34 }} />}
                            </Box>

                            {/* Picker content based on mode */}
                            {pickerMode === 'year' && activeMonthIndex === i && renderYearPicker(monthDate, i)}
                            {pickerMode === 'month' && activeMonthIndex === i && renderMonthPicker(monthDate, i)}
                            {(pickerMode === 'day' || activeMonthIndex !== i) && (
                                <>
                                    {/* Day names */}
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 1 }}>
                                        {dayNames.map((day) => (
                                            <Box key={day} sx={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#666' }}>
                                                {day}
                                            </Box>
                                        ))}
                                    </Box>

                                    {/* Calendar grid */}
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, mb: 2 }} onMouseLeave={() => setHoverDate(null)}>
                                        {renderCalendar(monthDate)}
                                    </Box>
                                </>
                            )}
                        </Box>
                    );
                })}
            </Box>

            {/* Footer */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                <Typography onClick={handleToday} sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 600, fontSize: '14px', '&:hover': { textDecoration: 'underline' } }}>Hoje</Typography>
                <Typography onClick={handleWeek} sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 600, fontSize: '14px', '&:hover': { textDecoration: 'underline' } }}>Semana</Typography>
                <Typography onClick={handleMonth} sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 600, fontSize: '14px', '&:hover': { textDecoration: 'underline' } }}>Mês</Typography>
                <Typography onClick={handleYear} sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 600, fontSize: '14px', '&:hover': { textDecoration: 'underline' } }}>Ano</Typography>
            </Box>

            {/* Selected range display */}
            {formatDateRange() && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontSize: '13px' }}>{formatDateRange()}</Typography>
                    <IconButton size="small" onClick={handleClear}><CloseIcon fontSize="small" /></IconButton>
                </Box>
            )}
        </Popover>
    );

    if (labelPosition === 'top' && label) {
        return (
            <Box sx={{ width: '100%' }} ref={anchorRef}>
                <label
                    htmlFor={inputId}
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: disabled ? '#999' : '#333',
                    }}
                >
                    {label}
                    {required && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
                </label>
                {textFieldContent}
                {calendarPopover}
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }} ref={anchorRef}>
            {textFieldContent}
            {calendarPopover}
        </Box>
    );
}
