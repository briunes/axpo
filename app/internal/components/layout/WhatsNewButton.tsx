"use client";

import {
  IconButton,
  type IconButtonProps,
  Tooltip,
} from "@mui/material";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import { openWhatsNewModal } from "../../../components/WhatsNewModal";

export function WhatsNewButton({
  buttonClassName = "topbar-icon-btn",
  buttonSx,
}: {
  buttonClassName?: string;
  buttonSx?: IconButtonProps["sx"];
}) {
  return (
    <Tooltip title="What's new">
      <IconButton
        className={buttonClassName}
        onClick={openWhatsNewModal}
        aria-label="What's new"
        size="small"
        sx={buttonSx}
      >
        <NewReleasesIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
