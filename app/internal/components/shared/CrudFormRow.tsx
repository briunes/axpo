"use client";

export interface CrudFormRowProps {
    children: React.ReactNode;
    columns?: 2 | 3;
}

/**
 * Grid row for organizing form fields side-by-side
 */
export function CrudFormRow({ children, columns = 2 }: CrudFormRowProps) {
    return (
        <div
            className="crud-form-row"
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: '16px'
            }}
        >
            {children}
        </div>
    );
}
