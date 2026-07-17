"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import {
  Box,
  FormControlLabel,
  Stack,
  Switch,
  Tabs,
  Tab,
  Button,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import { loadSession } from "../../../lib/authSession";
import { useI18n } from "../../../../../src/lib/i18n-context";
import {
  getAgency,
  updateAgency,
  listUsers,
  type AgencyItem,
  type UserItem,
} from "../../../lib/internalApi";
import {
  AddressForm,
  BoneyardFormSkeleton,
  CrudFormContainer,
  CrudPageLayout,
  useAlerts,
  type AddressData,
} from "../../../components/shared";
import {
  FormInput,
  DataTable,
  StatusBadge,
  AuditLogsModal,
} from "../../../components/ui";
import { AgencyTariffConfig } from "../../../components/ui/AgencyTariffConfig";
import { AgencyTlvProductConfig } from "../../../components/ui/AgencyTlvProductConfig";
import { useActionButtons, useTopBarBreadcrumbs } from "../../../components/InternalWorkspace";

interface ValidationErrors {
  name?: string;
}

export default function EditAgencyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const isBoneyardFixture = id === "boneyard-fixture";
  const router = useRouter();
  const [session] = useState(loadSession());
  const { showSuccess, showError } = useAlerts();
  const { t } = useI18n();
  const onActionButtons = useActionButtons();

  const [agency, setAgency] = useState<AgencyItem | null>(null);
  const [name, setName] = useState("");
  const [isTlv, setIsTlv] = useState(false);
  const [address, setAddress] = useState<AddressData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);
  const [formActions, setFormActions] = useState<React.ReactNode>(null);
  const [tariffsDraft, setTariffsDraft] = useState<
    Array<{ tariffType: string; isEnabled: boolean }>
  >([]);
  const [productsDraft, setProductsDraft] = useState<
    Array<{
      productKey: string;
      commodity: "ELECTRICITY" | "GAS";
      pricingType: "FIXED" | "INDEXED";
      isEnabled: boolean;
    }>
  >([]);
  const breadcrumbs = useMemo(
    () => agency ? [{ label: agency.name, href: `/internal/agencies/${agency.id}/edit` }] : null,
    [agency],
  );
  useTopBarBreadcrumbs(breadcrumbs);

  useEffect(() => {
    if (!session || isBoneyardFixture) return;
    getAgency(session.token, id)
      .then((a) => {
        setAgency(a);
        setName(a.name);
        setIsTlv(Boolean(a.isTlv));
        setAddress({
          street: a.street || "",
          city: a.city || "",
          postalCode: a.postalCode || "",
          province: a.province || "",
          country: a.country || "",
        });
        // Load users for this agency
        setLoadingUsers(true);
        listUsers(session.token, { agencyId: a.id, pageSize: 100 })
          .then((result) => setUsers(result.items))
          .catch((err) => console.error("Failed to load users:", err))
          .finally(() => setLoadingUsers(false));
      })
      .catch((err) => {
        showError(
          err instanceof Error ? err.message : t("agencyFormPage", "notFound"),
        );
        router.push("/internal/agencies");
      });
  }, [session, id, isBoneyardFixture]);

  const clearError = (field: keyof ValidationErrors) => {
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    if (!name.trim()) {
      errors.name = t("agencyFormPage", "validNameRequired");
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !agency) return;
    if (!validateForm()) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await updateAgency(session.token, agency.id, {
        name: name.trim(),
        isTlv,
        street: address.street?.trim() || undefined,
        city: address.city?.trim() || undefined,
        postalCode: address.postalCode?.trim() || undefined,
        province: address.province?.trim() || undefined,
        country: address.country?.trim() || undefined,
        tariffs: tariffsDraft.length > 0 ? tariffsDraft : undefined,
        products: productsDraft.length > 0 ? productsDraft : undefined,
      });

      showSuccess(t("agencyFormPage", "updated"));
      router.push("/internal/agencies");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t("agencyFormPage", "updateFailed");
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!session || !agency) {
      onActionButtons?.(null);
      return;
    }

    onActionButtons?.(
      <>
        <span className="topbar-action-wrap">
          <Button
            className="topbar-action topbar-action--compact"
            variant="outlined"
            size="small"
            startIcon={<HistoryIcon />}
            onClick={() => setShowAuditLogsModal(true)}
          >
            <span className="topbar-action-label">{t("auditLogsModal", "title")}</span>
          </Button>
        </span>
        {formActions}
      </>,
    );

    return () => onActionButtons?.(null);
  }, [agency, formActions, onActionButtons, session, t]);

  if (!session || !agency) {
    return (
      <CrudPageLayout
        title={t("agencyFormPage", "editTitle")}
        backHref="/internal/agencies"
        hideHeader
      >
        <BoneyardFormSkeleton name="edit-agency-form" shape="agency" tabs={2} />
      </CrudPageLayout>
    );
  }

  const userColumns = [
    {
      key: "fullName",
      label: t("columns", "name"),
      sortable: false,
      renderCell: (row: UserItem) => row.fullName,
    },
    {
      key: "email",
      label: t("columns", "email"),
      sortable: false,
      renderCell: (row: UserItem) => row.email,
    },
    {
      key: "role",
      label: t("columns", "role"),
      sortable: false,
      renderCell: (row: UserItem) => (
        <StatusBadge
          label={
            row.role === "SYS_ADMIN"
              ? t("userFormPage", "roleSysAdmin")
              : row.role === "ADMIN"
                ? t("userFormPage", "roleAdmin")
                : row.role === "AGENT"
                  ? t("userFormPage", "roleAgent")
                  : t("userFormPage", "roleCommercial")
          }
          tone={
            row.role === "SYS_ADMIN"
              ? "warning"
              : row.role === "ADMIN"
                ? "brand"
                : row.role === "AGENT"
                  ? "accent"
                  : "neutral"
          }
        />
      ),
    },
    {
      key: "status",
      label: t("columns", "status"),
      sortable: false,
      renderCell: (row: UserItem) => (
        <StatusBadge
          label={row.isActive ? t("status", "active") : t("status", "inactive")}
          tone={row.isActive ? "success" : "neutral"}
        />
      ),
    },
  ];

  return (
    <CrudPageLayout
      title={t("agencyFormPage", "editTitle")}
      subtitle={t("agencyFormPage", "editSubtitle", { name: agency.name })}
      backHref="/internal/agencies"
      hideHeader
    >
      <Box className="crud-tab-panel">
        <Box className="crud-tab-panel__tabs">
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
          >
            <Tab label={t("agencyFormPage", "tabDetails")} />
            <Tab label={t("agencyFormPage", "tabUsers")} />
            <Tab label={t("agencyFormPage", "tabProducts")} />
            {false && <Tab label={t("agencyFormPage", "tabTariffs")} />}
          </Tabs>
        </Box>
        <Box sx={{ display: activeTab === 0 ? "block" : "none" }}>
          <CrudFormContainer
            onSubmit={handleSubmit}
            errorMessage={errorMessage}
            submitLabel={t("actions", "saveChanges")}
            cancelLabel={t("actions", "cancel")}
            onCancel={() => router.push("/internal/agencies")}
            isSubmitting={isSubmitting}
            onRenderActions={setFormActions}
          >
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
                  alignItems: "flex-end",
                  columnGap: 3,
                  rowGap: 1.5,
                }}
              >
                <FormInput
                  label={t("agencyFormPage", "nameLabel")}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName((e.target as HTMLInputElement).value);
                    clearError("name");
                  }}
                  autoFocus
                  required
                  disabled={isSubmitting}
                  error={!!validationErrors.name}
                  helperText={validationErrors.name}
                />
                <FormControlLabel
                  sx={{
                    mb: validationErrors.name ? "24px" : 0,
                    mr: 0,
                    minHeight: "37px",
                    whiteSpace: "nowrap",
                  }}
                  control={
                    <Switch
                      checked={isTlv}
                      onChange={(event) => setIsTlv(event.target.checked)}
                      disabled={isSubmitting}
                    />
                  }
                  label={t("agencyFormPage", "tlvAgencyLabel")}
                />
              </Box>
              <AddressForm
                value={address}
                onChange={setAddress}
                disabled={isSubmitting}
              />
            </Stack>
          </CrudFormContainer>
        </Box>
        {activeTab === 1 && (
          <Box>
            <Box sx={{ mb: 2 }}>
              <h3 style={{ margin: 0, marginBottom: "4px", fontSize: "1.1rem" }}>
                {t("agencyFormPage", "assignedUsers")}
              </h3>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>
                {t("agencyFormPage", "assignedUsersSubtitle")}
              </p>
            </Box>
            <DataTable<UserItem>
              columns={userColumns}
              rows={users}
              loading={loadingUsers}
              onClearFilters={() => undefined}
              hasActiveFilters={false}
              emptyMessage={t("agencyFormPage", "noUsers")}
              t={t}
            />
          </Box>
        )}
        <Box sx={{ display: activeTab === 3 ? "block" : "none" }}>
          <AgencyTariffConfig
            agencyId={agency.id}
            token={session.token}
            hideSaveButton
            onTariffsChange={setTariffsDraft}
            onNotify={(msg, type) =>
              type === "error" ? showError(msg) : showSuccess(msg)
            }
          />
        </Box>
        <Box sx={{ display: activeTab === 2 ? "block" : "none" }}>
            <AgencyTlvProductConfig
              agencyId={agency.id}
              token={session.token}
              isTlv={isTlv}
              hideSaveButton
              onProductsChange={setProductsDraft}
              onNotify={(msg, type) =>
                type === "error" ? showError(msg) : showSuccess(msg)
              }
            />
        </Box>
      </Box>
      {session && (
        <AuditLogsModal
          open={showAuditLogsModal}
          onClose={() => setShowAuditLogsModal(false)}
          targetType="AGENCY"
          targetId={agency.id}
          token={session.token}
          title={`${t("auditLogsModal", "title")} - ${agency.name}`}
        />
      )}
    </CrudPageLayout>
  );
}
