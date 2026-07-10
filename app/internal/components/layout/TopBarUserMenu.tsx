"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Box,
    Button,
    Divider,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import TranslateIcon from "@mui/icons-material/Translate";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import type { SessionState } from "../../lib/authSession";
import { useI18n } from "../../../../src/lib/i18n-context";
import { UI_LANGUAGES } from "../../../../src/lib/uiLanguages";
import { LanguageFlag } from "../../../../src/lib/LanguageFlag";
import { useThemeMode } from "../../lib/ThemeModeContext";

function getInitials(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

const ROLE_LABEL_KEY: Record<SessionState["user"]["role"], "roleSysAdmin" | "roleAdmin" | "roleAgent" | "roleCommercial"> = {
    SYS_ADMIN: "roleSysAdmin",
    ADMIN: "roleAdmin",
    AGENT: "roleAgent",
    COMMERCIAL: "roleCommercial",
};

export function TopBarUserMenu({
    session,
    onLogout,
}: {
    session: SessionState;
    onLogout: () => void;
}) {
    const router = useRouter();
    const { t, locale, setLocale } = useI18n();
    const { mode, toggleMode } = useThemeMode();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [languageAnchorEl, setLanguageAnchorEl] = useState<HTMLElement | null>(null);
    const closeLanguageTimerRef = useRef<number | null>(null);
    const mainMenuPaperRef = useRef<HTMLDivElement | null>(null);
    const languageMenuPaperRef = useRef<HTMLDivElement | null>(null);

    const languageOptions = useMemo(
        () =>
            UI_LANGUAGES.map((item) => ({
                locale: item.code,
                label: item.label,
            })),
        [],
    );

    const activeLanguage =
        languageOptions.find((option) => option.locale === locale) ?? languageOptions[0] ?? null;
    const open = Boolean(anchorEl);
    const languageMenuOpen = Boolean(languageAnchorEl);

    const openLanguageMenu = (target: HTMLElement) => {
        if (closeLanguageTimerRef.current) {
            window.clearTimeout(closeLanguageTimerRef.current);
            closeLanguageTimerRef.current = null;
        }
        setLanguageAnchorEl(target);
    };

    const closeLanguageMenu = () => {
        if (closeLanguageTimerRef.current) {
            window.clearTimeout(closeLanguageTimerRef.current);
            closeLanguageTimerRef.current = null;
        }
        setLanguageAnchorEl(null);
    };

    const scheduleLanguageMenuClose = () => {
        if (closeLanguageTimerRef.current) {
            window.clearTimeout(closeLanguageTimerRef.current);
        }
        closeLanguageTimerRef.current = window.setTimeout(() => {
            const isLanguageMenuHovered = languageMenuPaperRef.current?.matches(":hover") ?? false;

            if (isLanguageMenuHovered) {
                closeLanguageTimerRef.current = null;
                return;
            }

            setLanguageAnchorEl(null);
            closeLanguageTimerRef.current = null;
        }, 220);
    };

    const closeAllMenus = () => {
        closeLanguageMenu();
        setAnchorEl(null);
    };

    return (
        <>
            <Button
                className="topbar-user-trigger"
                type="button"
                aria-label={t("nav", "myProfile")}
                aria-haspopup="menu"
                aria-expanded={open}
                onMouseOver={(event) => setAnchorEl(event.currentTarget)}
            >
                {/* <Box className="app-user-avatar topbar-user-avatar" aria-hidden="true">
                    {getInitials(session.user.fullName)}
                </Box> */}
                <Box className="topbar-user-meta">
                    <Typography component="span" variant="body2" className="topbar-user-name">
                        {session.user.fullName}
                    </Typography>
                    <Typography component="span" variant="caption" className="topbar-user-role" sx={{ display: "flex", alignItems: "center",justifyContent: 'space-between', width: '100%' }}>
                        {t("userFormPage", ROLE_LABEL_KEY[session.user.role] ?? "roleCommercial")}
                        <KeyboardArrowDownIcon fontSize="small" className="topbar-user-chevron" />
                    </Typography>
                </Box>
            </Button>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={closeAllMenus}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                    list: {
                        onMouseLeave: () => {
                            if (languageMenuOpen) {
                                return;
                            }
                            closeAllMenus();
                        },
                    },
                    paper: {
                        ref: (node: HTMLDivElement | null) => {
                            mainMenuPaperRef.current = node;
                        },
                        onMouseEnter: () => {
                            if (closeLanguageTimerRef.current) {
                                window.clearTimeout(closeLanguageTimerRef.current);
                                closeLanguageTimerRef.current = null;
                            }
                        },
                        sx: { width: 250, minWidth: 250 },
                    },
                }}
            >
                <MenuItem
                    onMouseEnter={closeLanguageMenu}
                    onClick={() => {
                        closeAllMenus();
                        router.push("/internal/profile");
                    }}
                >
                    <ListItemIcon>
                        <PersonOutlineIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{t("nav", "myProfile")}</ListItemText>
                </MenuItem>

                <MenuItem
                    onMouseEnter={closeLanguageMenu}
                    onClick={() => {
                        closeAllMenus();
                        router.push("/internal/changelog");
                    }}
                >
                    <ListItemIcon>
                        <NewReleasesIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{t("nav", "whatsNew")}</ListItemText>
                </MenuItem>

                <MenuItem
                    onMouseEnter={closeLanguageMenu}
                    onClick={() => {
                        toggleMode();
                    }}
                >
                    <ListItemIcon>
                        {mode === "dark" ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText>
                        {mode === "dark" ? t("theme", "lightMode") : t("theme", "darkMode")}
                    </ListItemText>
                </MenuItem>

                <MenuItem
                    onMouseEnter={(event) => openLanguageMenu(event.currentTarget)}
                >
                    <ListItemIcon>
                        {activeLanguage?.locale ? (
                            <LanguageFlag code={activeLanguage.locale} label={activeLanguage.label} width={20} height={14} />
                        ) : (
                            <TranslateIcon fontSize="small" />
                        )}
                    </ListItemIcon>
                    <ListItemText>
                        {activeLanguage?.label
                            ? `${activeLanguage.label}`
                            : t("nav", "languageSelector")}
                    </ListItemText>
                </MenuItem>

                <Divider />

                <MenuItem
                    onMouseEnter={closeLanguageMenu}
                    onClick={() => {
                        closeAllMenus();
                        onLogout();
                    }}
                    className="topbar-user-menu-logout"
                >
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{t("actions", "signOut")}</ListItemText>
                </MenuItem>
            </Menu>

            <Menu
                anchorEl={languageAnchorEl}
                open={languageMenuOpen}
                onClose={closeLanguageMenu}
                anchorOrigin={{ vertical: "top", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                    paper: {
                        ref: (node: HTMLDivElement | null) => {
                            languageMenuPaperRef.current = node;
                        },
                        className: "topbar-user-submenu",
                        sx: { width: 230, minWidth: 230 },
                        onMouseEnter: () => {
                            if (closeLanguageTimerRef.current) {
                                window.clearTimeout(closeLanguageTimerRef.current);
                                closeLanguageTimerRef.current = null;
                            }
                        },
                        onMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => {
                            const nextTarget = event.relatedTarget as Node | null;
                            if (nextTarget && mainMenuPaperRef.current?.contains(nextTarget)) {
                                closeLanguageMenu();
                                return;
                            }
                            scheduleLanguageMenuClose();
                        },
                    },
                }}
            >
                {languageOptions.map((option) => {
                    const isActive = option.locale === activeLanguage?.locale;
                    return (
                        <MenuItem
                            key={option.locale}
                            selected={isActive}
                            onClick={() => {
                                if (isActive) {
                                    return;
                                }
                                setLocale(option.locale);
                                closeLanguageMenu();
                            }}
                        >
                            <ListItemIcon>
                                <LanguageFlag code={option.locale} label={option.label} width={20} height={14} />
                            </ListItemIcon>
                            <ListItemText>{option.label}</ListItemText>
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );
}
