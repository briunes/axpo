import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Maintenance | AXPO Simulator",
    description: "The application is temporarily down for maintenance.",
};

interface Props {
    searchParams: Promise<{ until?: string; message?: string }>;
}

function formatDateTime(isoString: string): string {
    try {
        const date = new Date(isoString);
        return date.toLocaleString("en-GB", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
        });
    } catch {
        return isoString;
    }
}

export default async function MaintenancePage({ searchParams }: Props) {
    const params = await searchParams;
    const until = params.until ?? null;
    const message = params.message ? decodeURIComponent(params.message) : null;

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #0f0f14 0%, #1a1a2e 50%, #16213e 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        }}>
            <div style={{
                maxWidth: 560,
                width: "100%",
                textAlign: "center",
            }}>
                {/* Logo / Icon */}
                <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 32px",
                    boxShadow: "0 0 40px rgba(249, 115, 22, 0.3)",
                }}>
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                </div>

                {/* Heading */}
                <h1 style={{
                    color: "#ffffff",
                    fontSize: "2rem",
                    fontWeight: 700,
                    margin: "0 0 12px",
                    letterSpacing: "-0.02em",
                }}>
                    Down for Maintenance
                </h1>

                {/* Subtitle */}
                <p style={{
                    color: "#94a3b8",
                    fontSize: "1.05rem",
                    lineHeight: 1.6,
                    margin: "0 0 32px",
                }}>
                    {message
                        ? message
                        : "We're performing scheduled maintenance to improve your experience. We'll be back shortly."}
                </p>

                {/* Expected time card */}
                {until && (
                    <div style={{
                        background: "rgba(249, 115, 22, 0.08)",
                        border: "1px solid rgba(249, 115, 22, 0.25)",
                        borderRadius: 12,
                        padding: "20px 24px",
                        marginBottom: 32,
                    }}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            marginBottom: 8,
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span style={{ color: "#f97316", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                Expected back online
                            </span>
                        </div>
                        <p style={{
                            color: "#f1f5f9",
                            fontSize: "1.1rem",
                            fontWeight: 600,
                            margin: 0,
                        }}>
                            {formatDateTime(until)}
                        </p>
                    </div>
                )}

                {/* Divider */}
                <div style={{
                    height: 1,
                    background: "rgba(148, 163, 184, 0.1)",
                    marginBottom: 28,
                }} />

                {/* Footer note */}
                <p style={{
                    color: "#475569",
                    fontSize: "0.85rem",
                    margin: 0,
                }}>
                    If you need immediate assistance, please contact your account manager.
                </p>

                {/* AXPO branding */}
                <p style={{
                    color: "#334155",
                    fontSize: "0.8rem",
                    marginTop: 24,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                }}>
                    AXPO Simulator
                </p>
            </div>
        </div>
    );
}
