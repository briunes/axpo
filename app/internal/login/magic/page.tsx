"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@mui/material";
import { saveSession } from "../../lib/authSession";
import { getBrowserFingerprint } from "../../lib/browserFingerprint";
import { useI18n } from "../../../../src/lib/i18n-context";
import "../../globals.css";

export default function MagicLinkVerifyPage() {
    return (
        <Suspense>
            <MagicLinkVerifyContent />
        </Suspense>
    );
}

function MagicLinkVerifyContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useI18n();

    const token = searchParams.get("token") ?? "";
    const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
    const [errorText, setErrorText] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setErrorText(t("magicLink", "missingToken"));
            return;
        }

        const verify = async () => {
            try {
                const browserFingerprint = await getBrowserFingerprint();
                const res = await fetch(
                    `/api/v1/internal/auth/magic-link/verify?token=${encodeURIComponent(token)}`,
                    browserFingerprint
                        ? {
                            headers: {
                                "x-browser-fingerprint": browserFingerprint,
                            },
                        }
                        : undefined,
                );
                const body = await res.json();

                if (!res.ok || !body.success) {
                    setStatus("error");
                    setErrorText(body?.error?.message || t("magicLink", "verifyFailed"));
                    return;
                }

                const { token: authToken, user } = body.data;
                saveSession({ token: authToken, user });
                setStatus("success");
                setTimeout(() => router.replace("/internal/simulations"), 800);
            } catch {
                setStatus("error");
                setErrorText(t("magicLink", "verifyFailed"));
            }
        };

        verify();
    }, [token, router, t]);

    return (
        <div className="login-shell-v2">
            <div className="login-grid-v2">
                <div className="login-brand-panel-v2">
                    <img src="/axpo-mark.svg" className="login-brand-mark-v2" width={72} height={72} alt="AXPO" />
                    <div className="login-brand-name-v2">AXPO</div>
                    <div className="login-brand-divider-v2" />
                    <div className="login-brand-product-v2">OFFERS SIMULATOR</div>
                </div>

                <div className="login-form-panel-v2">
                    <div className="login-form-logo-v2">
                        <img src="/axpo-mark.svg" width={32} height={32} alt="AXPO" />
                    </div>

                    {status === "verifying" && (
                        <>
                            <h2 className="login-form-title-v2">{t("magicLink", "verifyingTitle")}</h2>
                            <p className="login-form-subtitle-v2">{t("magicLink", "verifyingSubtitle")}</p>
                        </>
                    )}

                    {status === "success" && (
                        <>
                            <h2 className="login-form-title-v2">{t("magicLink", "successTitle")}</h2>
                            <p className="login-form-subtitle-v2">{t("magicLink", "successSubtitle")}</p>
                        </>
                    )}

                    {status === "error" && (
                        <>
                            <h2 className="login-form-title-v2">{t("magicLink", "errorTitle")}</h2>
                            <p className="login-form-subtitle-v2" style={{ color: "var(--axpo-error, #ef4444)" }}>
                                {errorText || t("magicLink", "verifyFailed")}
                            </p>
                            <Button
                                variant="outlined"
                                fullWidth
                                sx={{ mt: 2 }}
                                onClick={() => router.replace("/internal/login")}
                            >
                                {t("magicLink", "backToLogin")}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
