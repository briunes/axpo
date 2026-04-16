"use client";

// Material-UI icons for AXPO internal navigation

import MonitorIcon from "@mui/icons-material/Monitor";
import PeopleIcon from "@mui/icons-material/People";
import BusinessIcon from "@mui/icons-material/Business";
import PersonIcon from "@mui/icons-material/Person";
import TuneIcon from "@mui/icons-material/Tune";
import DescriptionIcon from "@mui/icons-material/Description";
import EmailIcon from "@mui/icons-material/Email";
import BarChartIcon from "@mui/icons-material/BarChart";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import MenuIcon from "@mui/icons-material/Menu";

export function SimulationsIcon({ className }: { className?: string }) {
  return <MonitorIcon className={className} sx={{ fontSize: 18 }} />;
}

export function UsersIcon({ className }: { className?: string }) {
  return <PeopleIcon className={className} sx={{ fontSize: 18 }} />;
}

export function AgenciesIcon({ className }: { className?: string }) {
  return <BusinessIcon className={className} sx={{ fontSize: 18 }} />;
}

export function BaseValuesIcon({ className }: { className?: string }) {
  return <TuneIcon className={className} sx={{ fontSize: 18 }} />;
}

export function AuditLogsIcon({ className }: { className?: string }) {
  return <DescriptionIcon className={className} sx={{ fontSize: 18 }} />;
}

export function EmailLogsIcon({ className }: { className?: string }) {
  return <EmailIcon className={className} sx={{ fontSize: 18 }} />;
}

export function AnalyticsIcon({ className }: { className?: string }) {
  return <BarChartIcon className={className} sx={{ fontSize: 18 }} />;
}

export function ClientsIcon({ className }: { className?: string }) {
  return <PersonIcon className={className} sx={{ fontSize: 18 }} />;
}

export function ConfigurationsIcon({ className }: { className?: string }) {
  return <SettingsIcon className={className} sx={{ fontSize: 18 }} />;
}

export { LogoutIcon, ChevronLeftIcon, ChevronRightIcon, RefreshIcon, MenuIcon };

