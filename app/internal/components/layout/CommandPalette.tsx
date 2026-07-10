"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import DescriptionIcon from "@mui/icons-material/Description";
import GroupIcon from "@mui/icons-material/Group";
import HistoryIcon from "@mui/icons-material/History";
import PersonIcon from "@mui/icons-material/Person";
import SearchIcon from "@mui/icons-material/Search";
import type { AppSection } from "./SectionMenu";
import { getCommandShortcutLabel } from "./shortcutLabel";
import {
  listAgencies,
  listClients,
  listSimulations,
  listUsers,
  type AgencyItem,
  type ClientItem,
  type SimulationItem,
  type UserItem,
} from "../../lib/internalApi";

type SearchKind = "simulation" | "user" | "agency" | "client" | "page";

export interface GlobalSearchRecentItem {
  id: string;
  kind: SearchKind;
  label: string;
  description?: string;
  href: string;
}

interface GlobalSearchResult extends GlobalSearchRecentItem {
  meta?: string;
}

const RECENTS_STORAGE_KEY = "axpo_global_search_recents";
const MIN_QUERY_LENGTH = 2;
const MODULE_RESULT_LIMIT = 3;
const SEARCH_DEBOUNCE_MS = 600;

function matchesPrimary(value: string | null | undefined, query: string) {
  return (value ?? "").toLowerCase().includes(query.toLowerCase());
}

function readRecents(): GlobalSearchRecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GlobalSearchRecentItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function writeRecents(items: GlobalSearchRecentItem[]) {
  try {
    localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(items.slice(0, 8)));
  } catch {
    // local recents are a convenience only
  }
}

function resultIcon(kind: SearchKind) {
  switch (kind) {
    case "simulation":
      return <DescriptionIcon fontSize="small" />;
    case "user":
      return <PersonIcon fontSize="small" />;
    case "agency":
      return <BusinessIcon fontSize="small" />;
    case "client":
      return <GroupIcon fontSize="small" />;
    case "page":
      return <HistoryIcon fontSize="small" />;
  }
}

function kindLabel(kind: SearchKind) {
  switch (kind) {
    case "simulation":
      return "Simulation";
    case "user":
      return "User";
    case "agency":
      return "Agency";
    case "client":
      return "Client";
    case "page":
      return "Recent";
  }
}

function simulationHref(simulation: SimulationItem) {
  return simulation.status === "SHARED"
    ? `/internal/simulations/${simulation.id}/view`
    : `/internal/simulations/${simulation.id}`;
}

function simulationLabel(simulation: SimulationItem) {
  return simulation.referenceNumber ?? simulation.client?.name ?? simulation.id.slice(0, 8);
}

function mapSimulation(simulation: SimulationItem): GlobalSearchResult {
  return {
    id: `simulation-${simulation.id}`,
    kind: "simulation",
    label: simulationLabel(simulation),
    description: [
      simulation.client?.name,
      simulation.ownerUser?.fullName,
      simulation.status,
    ].filter(Boolean).join(" · "),
    href: simulationHref(simulation),
    meta: simulation.cupsNumber ?? undefined,
  };
}

function mapUser(user: UserItem): GlobalSearchResult {
  return {
    id: `user-${user.id}`,
    kind: "user",
    label: user.fullName || user.email,
    description: [user.email, user.role].filter(Boolean).join(" · "),
    href: `/internal/users/${user.id}/edit`,
  };
}

function mapAgency(agency: AgencyItem): GlobalSearchResult {
  return {
    id: `agency-${agency.id}`,
    kind: "agency",
    label: agency.name,
    description: agency.isTlv ? "TLV agency" : "Agency",
    href: `/internal/agencies/${agency.id}/edit`,
  };
}

function mapClient(client: ClientItem): GlobalSearchResult {
  return {
    id: `client-${client.id}`,
    kind: "client",
    label: client.name,
    description: [client.cif, client.contactEmail].filter(Boolean).join(" · "),
    href: `/internal/clients/${client.id}/edit`,
  };
}

export function CommandPalette({
  open,
  onClose,
  availableSections,
  token,
}: {
  open: boolean;
  onClose: () => void;
  availableSections: AppSection[];
  token: string;
}) {
  const router = useRouter();
  const shortcutLabel = getCommandShortcutLabel();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recents, setRecents] = useState<GlobalSearchRecentItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) setRecents(readRecents());
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const canSearchSimulations = availableSections.includes("simulations");
  const canSearchUsers = availableSections.includes("users");
  const canSearchAgencies = availableSections.includes("agencies");
  const canSearchClients = availableSections.includes("clients");

  const searchQuery = useQuery({
    queryKey: ["global-search", token, debouncedQuery, availableSections.join("|")],
    enabled: open && debouncedQuery.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
    queryFn: async (): Promise<GlobalSearchResult[]> => {
      const searches: Array<Promise<GlobalSearchResult[]>> = [];

      if (canSearchSimulations) {
        searches.push(
          listSimulations(token, {
              page: 1,
            pageSize: 12,
              search: debouncedQuery,
              orderBy: "updatedAt",
              sortDir: "desc",
            }).then((response) => response.items
              .filter((simulation) => matchesPrimary(simulation.referenceNumber, debouncedQuery))
              .slice(0, MODULE_RESULT_LIMIT)
              .map(mapSimulation)),
        );
      }

      if (canSearchClients) {
        searches.push(
          listClients(token, {
              page: 1,
              pageSize: 12,
              search: debouncedQuery,
              orderBy: "name",
              sortDir: "asc",
              minimal: true,
            }).then((response) => response.items
              .filter((client) => matchesPrimary(client.name, debouncedQuery))
              .slice(0, MODULE_RESULT_LIMIT)
              .map(mapClient)),
        );
      }

      if (canSearchUsers) {
        searches.push(
          listUsers(token, {
              page: 1,
              pageSize: 12,
              search: debouncedQuery,
              contextual: true,
              orderBy: "fullName",
              sortDir: "asc",
            }).then((response) => response.items
              .filter((user) => matchesPrimary(user.fullName, debouncedQuery))
              .slice(0, MODULE_RESULT_LIMIT)
              .map(mapUser)),
        );
      }

      if (canSearchAgencies) {
        searches.push(
          listAgencies(token, {
              page: 1,
              pageSize: 12,
              search: debouncedQuery,
              orderBy: "name",
              sortDir: "asc",
              minimal: true,
            }).then((response) => response.items
              .filter((agency) => matchesPrimary(agency.name, debouncedQuery))
              .slice(0, MODULE_RESULT_LIMIT)
              .map(mapAgency)),
        );
      }

      const settled = await Promise.allSettled(searches);
      return settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    },
  });

  const shownItems = useMemo<GlobalSearchResult[]>(() => {
    if (debouncedQuery.length >= MIN_QUERY_LENGTH) return searchQuery.data ?? [];
    return recents;
  }, [debouncedQuery.length, recents, searchQuery.data]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery, shownItems.length]);

  const rememberAndNavigate = (item: GlobalSearchRecentItem) => {
    const next = [item, ...recents.filter((recent) => recent.id !== item.id)].slice(0, 8);
    setRecents(next);
    writeRecents(next);
    router.push(item.href);
    onClose();
  };

  const isSearching = debouncedQuery.length >= MIN_QUERY_LENGTH && searchQuery.isFetching;
  const showPrompt = query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH;
  const emptyText = debouncedQuery.length >= MIN_QUERY_LENGTH
    ? "No records found."
    : "Recently opened records and pages will appear here.";

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!shownItems.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % shownItems.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + shownItems.length) % shownItems.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const item = shownItems[activeIndex];
      if (item) rememberAndNavigate(item);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "var(--scheme-surface-raised)",
          border: "1px solid var(--scheme-neutral-900)",
          boxShadow: "var(--scheme-shadow-strong)",
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 1.5, borderBottom: "1px solid var(--scheme-neutral-900)" }}>
          <TextField
            autoFocus
            fullWidth
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search simulations, clients, users, agencies..."
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  {isSearching ? <CircularProgress size={18} /> : <Chip label={shortcutLabel} size="small" variant="outlined" />}
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <List sx={{ py: 0.75, maxHeight: "min(560px, 70vh)", overflowY: "auto" }}>
          {showPrompt ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Type at least {MIN_QUERY_LENGTH} characters to search records.
              </Typography>
            </Box>
          ) : shownItems.length > 0 ? shownItems.map((item, index) => {
            const isActive = index === activeIndex;
            return (
            <ListItemButton
              key={item.id}
              selected={isActive}
              onClick={() => rememberAndNavigate(item)}
              onMouseEnter={() => setActiveIndex(index)}
              sx={{
                mx: 0.75,
                my: 0.25,
                borderRadius: 1.25,
                "&.Mui-selected": {
                  bgcolor: "var(--scheme-brand-600-15)",
                  boxShadow: "inset 3px 0 0 var(--scheme-brand-600)",
                },
                "&.Mui-selected:hover": {
                  bgcolor: "var(--scheme-brand-600-15)",
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: "primary.main" }}>
                {resultIcon(item.kind)}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.description || item.href}
                primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
                secondaryTypographyProps={{ variant: "caption" }}
              />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {item.meta && (
                  <Typography variant="caption" color="text.secondary">
                    {item.meta}
                  </Typography>
                )}
                <Chip label={kindLabel(item.kind)} size="small" variant="outlined" />
              </Box>
            </ListItemButton>
          );
          }) : (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {emptyText}
              </Typography>
            </Box>
          )}
        </List>
      </DialogContent>
    </Dialog>
  );
}
