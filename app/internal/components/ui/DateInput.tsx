'use client';

import { useState, useEffect, useRef, useId } from 'react';
import {
    Box,
    IconButton,
    InputAdornment,
    InputLabel,
    Popover,
    TextField,
    Typography,
    styled,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import { useUserPreferences } from '../providers/UserPreferencesProvider';
import {
    formatDisplayDate,
    parseDisplayDate,
    autoFormatDateInput,
    getDatePlaceholder,
} from '../../lib/formatPreferences';

// ─── Date utilities ───────────────────────────────────────────────────────────

function parseDateInput(value: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

function formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ─── Styled text field ────────────────────────────────────────────────────────

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
    '& .MuiInputAdornment-root': { backgroundColor: 'transparent' },
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateInputProps {
    /** ISO date string `YYYY-MM-DD` (or full ISO timestamp). Controlled. */
    value?: string | null;
    /** Called with `YYYY-MM-DD` string when a date is picked, or `''` when cleared. */
    onChange?: (value: string) => void;
    label?: string;
    labelPosition?: 'top' | 'default';
    placeholder?: string;
    required?: boolean;
    error?: boolean;
    helperText?: string;
    disabled?: boolean;
    clearable?: boolean;
    nopadding?: boolean;
    id?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

function isSameDay(a: Date | null, b: Date | null): boolean {
    if (!a || !b) return false;
    return a.getDate() === b.getDate() &&
        a.getMonth() === b.getMonth() &&
        a.getFullYear() === b.getFullYear();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateInput({
    value,
    onChange,
    label,
    labelPosition = 'default',
    placeholder,
    required = false,
    error = false,
    helperText,
    disabled = false,
    clearable = true,
    nopadding = false,
    id,
}: DateInputProps) {
    const { preferences } = useUserPreferences();
    const dateFormat = preferences.dateFormat;
    const resolvedPlaceholder = placeholder ?? getDatePlaceholder(dateFormat);

    const generatedId = useId();
    const inputId = id || generatedId;
    const anchorRef = useRef<HTMLDivElement>(null);

    // Parse the controlled value into a Date
    const selectedDate = parseDateInput(value ?? null) ?? null;

    // Calendar navigation month (initialise to selected month, or today)
    const [currentMonth, setCurrentMonth] = useState<Date>(
        () => selectedDate ?? new Date()
    );
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [pickerMode, setPickerMode] = useState<'day' | 'month' | 'year'>('day');
    const yearPickerRef = useRef<HTMLDivElement>(null);
    const selectedYearRef = useRef<HTMLDivElement>(null);

    // Keep currentMonth in sync when the controlled value changes externally
    useEffect(() => {
        if (selectedDate) setCurrentMonth(selectedDate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

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

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleDayClick = (day: number) => {
        const picked = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        onChange?.(formatDateInput(picked));
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange?.('');
    };

    const handleToday = () => {
        const today = new Date();
        onChange?.(formatDateInput(today));
        setCurrentMonth(today);
        setIsOpen(false);
    };

    const handleFocus = () => {
        if (disabled) return;
        setInputText(selectedDate ? formatDisplayDate(selectedDate, dateFormat) : '');
        setIsEditing(true);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const digits = raw.replace(/[^0-9]/g, '');
        const formatted = autoFormatDateInput(digits, dateFormat);
        setInputText(formatted);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (!inputText.trim()) {
            onChange?.('');
            return;
        }
        const parsed = parseDisplayDate(inputText, dateFormat);
        if (parsed) {
            onChange?.(formatDateInput(parsed));
            setCurrentMonth(parsed);
        }
        // If unparseable, leave the controlled value as-is (reverts to last valid display)
    };

    // ── Calendar rendering ────────────────────────────────────────────────────

    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDayOfWeek = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const cells: React.ReactNode[] = [];

        // Empty leading cells
        for (let i = 0; i < firstDayOfWeek; i++) {
            cells.push(<Box key={`e-${i}`} sx={{ width: 40, height: 40 }} />);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, today);

            cells.push(
                <Box
                    key={day}
                    onClick={() => handleDayClick(day)}
                    sx={{
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        mt: 0.5,
                        '&:hover > div': {
                            backgroundColor: isSelected ? 'primary.dark' : 'action.hover',
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
                            backgroundColor: isSelected ? 'primary.main' : 'transparent',
                            color: isSelected ? '#fff' : isToday ? 'primary.main' : 'text.primary',
                            fontWeight: (isSelected || isToday) ? 600 : 400,
                            fontSize: '14px',
                            transition: 'background-color 0.2s',
                        }}
                    >
                        {day}
                    </Box>
                </Box>
            );
        }

        return cells;
    };

    // ── Dropdown calendar panel (Popover = portal, no overflow clipping) ──────

    // Generate year options (current year ± 50 years)
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 50;
    const endYear = currentYear + 50;

    const renderYearPicker = () => {
        const years: number[] = [];
        for (let y = startYear; y <= endYear; y++) {
            years.push(y);
        }
        return (
            <Box ref={yearPickerRef} sx={{ maxHeight: 280, overflowY: 'auto', px: 1 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                    {years.map((year) => {
                        const isCurrentYear = year === currentMonth.getFullYear();
                        return (
                            <Box
                                key={year}
                                ref={isCurrentYear ? selectedYearRef : null}
                                onClick={() => {
                                    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
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

    const renderMonthPicker = () => {
        return (
            <Box sx={{ px: 2, py: 1 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                    {MONTH_NAMES.map((month, idx) => (
                        <Box
                            key={idx}
                            onClick={() => {
                                setCurrentMonth(new Date(currentMonth.getFullYear(), idx, 1));
                                setPickerMode('day');
                            }}
                            sx={{
                                py: 1.5,
                                px: 1,
                                textAlign: 'center',
                                cursor: 'pointer',
                                borderRadius: '8px',
                                backgroundColor: idx === currentMonth.getMonth() ? 'primary.main' : 'transparent',
                                color: idx === currentMonth.getMonth() ? '#fff' : 'text.primary',
                                fontWeight: idx === currentMonth.getMonth() ? 600 : 400,
                                fontSize: '14px',
                                '&:hover': {
                                    backgroundColor: idx === currentMonth.getMonth() ? 'primary.dark' : 'action.hover',
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

    const calendarPanel = (
        <Popover
            open={isOpen && !disabled}
            anchorEl={anchorRef.current}
            onClose={() => {
                setIsOpen(false);
                setPickerMode('day');
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{ paper: { elevation: 8, sx: { padding: 2, minWidth: 300 } } }}
            disableAutoFocus
            disableEnforceFocus
        >
            {/* Month / year header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1 }}>
                <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    onClick={() => setPickerMode(pickerMode === 'year' ? 'day' : 'year')}
                    sx={{
                        cursor: 'pointer',
                        px: 1,
                        py: 0.5,
                        borderRadius: '4px',
                        '&:hover': { backgroundColor: 'action.hover' },
                    }}
                >
                    {currentMonth.getFullYear()}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        onClick={() => setPickerMode(pickerMode === 'month' ? 'day' : 'month')}
                        sx={{
                            cursor: 'pointer',
                            px: 1,
                            py: 0.5,
                            borderRadius: '4px',
                            '&:hover': { backgroundColor: 'action.hover' },
                        }}
                    >
                        {MONTH_NAMES[currentMonth.getMonth()]}
                    </Typography>
                    {pickerMode === 'day' && (
                        <>
                            <IconButton size="small" onClick={() =>
                                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
                            }>
                                <ChevronLeftIcon />
                            </IconButton>
                            <IconButton size="small" onClick={() =>
                                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
                            }>
                                <ChevronRightIcon />
                            </IconButton>
                        </>
                    )}
                </Box>
            </Box>

            {/* Picker content based on mode */}
            {pickerMode === 'year' && renderYearPicker()}
            {pickerMode === 'month' && renderMonthPicker()}
            {pickerMode === 'day' && (
                <>
                    {/* Day name headers */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 1 }}>
                        {DAY_NAMES.map((d) => (
                            <Box key={d} sx={{
                                width: 40, height: 30, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#666',
                            }}>
                                {d}
                            </Box>
                        ))}
                    </Box>

                    {/* Day grid */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, mb: 2 }}>
                        {renderCalendar()}
                    </Box>

                    {/* Footer */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                        <Typography
                            onClick={handleToday}
                            sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 600, fontSize: '14px', '&:hover': { textDecoration: 'underline' } }}
                        >
                            Hoje
                        </Typography>
                        {selectedDate && clearable && (
                            <Typography
                                onClick={handleClear}
                                sx={{ cursor: 'pointer', color: 'error.main', fontWeight: 600, fontSize: '14px', '&:hover': { textDecoration: 'underline' } }}
                            >
                                Limpar
                            </Typography>
                        )}
                    </Box>
                </>
            )}
        </Popover>
    );

    // ── Text field ────────────────────────────────────────────────────────────

    const displayValue = isEditing ? inputText : (selectedDate ? formatDisplayDate(selectedDate, dateFormat) : '');

    const inputProps = {
        startAdornment: (
            <InputAdornment position="start">
                <CalendarTodayIcon
                    onClick={(e) => { e.stopPropagation(); if (!disabled) setIsOpen((o) => !o); }}
                    sx={{ fontSize: '20px', color: error ? '#D32F2F' : 'primary.main', cursor: 'pointer' }}
                />
            </InputAdornment>
        ),
        ...(clearable && selectedDate ? {
            endAdornment: (
                <InputAdornment position="end">
                    <IconButton size="small" onClick={handleClear} disabled={disabled} sx={{ padding: '4px' }}>
                        <CloseIcon sx={{ fontSize: '18px' }} />
                    </IconButton>
                </InputAdornment>
            ),
        } : {}),
    };

    const textField = (
        <StyledTextField
            fullWidth
            size="small"
            value={displayValue}
            placeholder={resolvedPlaceholder}
            onChange={handleTextChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            error={error}
            required={required}
            helperText={helperText || undefined}
            nopadding={nopadding}
            id={inputId}
            label={labelPosition === 'default' ? label : undefined}
            slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { suppressHydrationWarning: true, maxLength: 10 },
                input: inputProps,
                formHelperText: { suppressHydrationWarning: true },
            }}
        />
    );

    // ── Render ────────────────────────────────────────────────────────────────

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
                {textField}
                {calendarPanel}
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }} ref={anchorRef}>
            {textField}
            {calendarPanel}
        </Box>
    );
}

export default DateInput;
