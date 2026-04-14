import { Chip } from "@mui/material";

type StatusTone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";

const statusToneToMuiColor: Record<StatusTone, "default" | "primary" | "success" | "warning" | "error" | "secondary"> = {
  neutral: "default",
  brand: "primary",
  success: "success",
  warning: "warning",
  danger: "error",
  accent: "secondary",
};

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <Chip
      label={label}
      color={statusToneToMuiColor[tone]}
      size="small"
      sx={{ fontWeight: 500, fontSize: '0.75rem' }}
    />
  );
}
