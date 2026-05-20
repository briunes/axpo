import type { ReactNode } from "react";

// Maintenance page has its own full-screen layout with no wrappers
export default function MaintenanceLayout({ children }: { children: ReactNode }) {
    return (
        <div style={{ margin: 0, padding: 0 }}>
            {children}
        </div>
    );
}
