"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  createUser,
  listUsers,
  rotateUserPin,
  requestUserPasswordReset,
  updateUser,
  updateUserStatus,
  deleteUser,
  type CreateUserResult,
  type ListUsersParams,
  type ListUsersResponse,
  type RotatePinResult,
  type UserItem,
  type UserRole,
} from "../../lib/internalApi";
import type { SessionState } from "../../lib/authSession";
import { useRequestCachePolicy } from "./useRequestCachePolicy";
import { normalizeQueryKeyParams } from "./queryKeys";

export interface UsersActions {
  users: UserItem[];
  loading: boolean;
  busyAction: string | null;
  errorText: string | null;
  successText: string | null;
  clearFeedback: () => void;
  refresh: (overrides?: ListUsersParams) => Promise<void>;
  // pagination
  page: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  // sort
  sortColumn: string;
  sortDir: "asc" | "desc";
  setSort: (column: string, dir: "asc" | "desc") => void;
  // search
  search: string;
  setSearch: (v: string) => void;
  // filters
  roleFilter: string;
  setRoleFilter: (v: string) => void;
  agencyFilter: string;
  setAgencyFilter: (v: string) => void;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  // create form
  newUserName: string;
  setNewUserName: (v: string) => void;
  newUserEmail: string;
  setNewUserEmail: (v: string) => void;
  newUserPassword: string;
  setNewUserPassword: (v: string) => void;
  newUserRole: UserRole;
  setNewUserRole: (v: UserRole) => void;
  newUserAgencyId: string;
  setNewUserAgencyId: (v: string) => void;
  handleCreateUser: (
    e: React.FormEvent,
    data?: {
      name: string;
      email: string;
      maxActiveDevices?: number;
      mobilePhone: string;
      commercialPhone: string;
      commercialEmail: string;
      otherDetails?: string;
      password?: string;
      role: UserRole;
      agencyId: string;
    },
  ) => Promise<CreateUserResult | null>;
  // edit
  selectedUserId: string | null;
  editUserName: string;
  setEditUserName: (v: string) => void;
  editUserEmail: string;
  setEditUserEmail: (v: string) => void;
  editUserPassword: string;
  setEditUserPassword: (v: string) => void;
  editUserCurrentPassword: string;
  setEditUserCurrentPassword: (v: string) => void;
  openUserEditor: (user: UserItem) => void;
  closeUserEditor: () => void;
  handleUpdateUser: (
    e: React.FormEvent,
    data?: {
      userId: string;
      name: string;
      email: string;
      maxActiveDevices?: number;
      mobilePhone: string;
      commercialPhone: string;
      commercialEmail: string;
      otherDetails?: string;
      role?: string;
      agencyId?: string;
      preferences?: {
        language?: string | null;
        dateFormat?: string | null;
        timeFormat?: string | null;
        timezone?: string | null;
        numberFormat?: string | null;
        itemsPerPage?: number | null;
      };
    },
  ) => Promise<void>;
  // self-service profile
  profileFullName: string;
  setProfileFullName: (v: string) => void;
  profileEmail: string;
  setProfileEmail: (v: string) => void;
  handleUpdateOwnProfile: (e: React.FormEvent) => Promise<void>;
  // actions
  handleToggleUserStatus: (user: UserItem) => Promise<void>;
  handleRotateUserPin: (user: UserItem) => Promise<RotatePinResult | null>;
  handleRequestPasswordReset: (user: UserItem) => Promise<void>;
  handleDeleteUser: (user: UserItem) => Promise<void>;
  handleBulkDeleteUsers: (ids: string[]) => Promise<void>;
}

interface UseUsersOptions {
  queryEnabled?: boolean;
  usePersistedState?: boolean;
  minimal?: boolean;
  contextual?: boolean;
  initialData?: ListUsersResponse;
  initialDataParams?: ListUsersParams;
}

interface UsersFilterPersistentState {
  roleFilter: string;
  agencyFilter: string;
  showArchived: boolean;
}

export function useUsers(
  session: SessionState | null,
  initialPageSize = 25,
  options?: UseUsersOptions,
): UsersActions {
  const queryClient = useQueryClient();
  const cachePolicy = useRequestCachePolicy("users");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const usePersistedState = options?.usePersistedState ?? true;
  const minimal = options?.minimal ?? false;
  const contextual = options?.contextual ?? false;

  // Load persisted state from localStorage
  const getPersistedState = () => {
    if (!usePersistedState) return null;
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("axpo_dt_state_users");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const persistedState = getPersistedState();

  const getPersistedFilters = (): UsersFilterPersistentState | null => {
    if (!usePersistedState) return null;
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("axpo_users_filters");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<UsersFilterPersistentState>;
      return {
        roleFilter: parsed.roleFilter ?? "",
        agencyFilter: parsed.agencyFilter ?? "",
        showArchived: parsed.showArchived ?? false,
      };
    } catch {
      return null;
    }
  };
  const persistedFilters = getPersistedFilters();

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  // sync pageSize when user preferences load
  useEffect(() => {
    setPageSize(initialPageSize);
    setPage(1);
  }, [initialPageSize]);
  // sort - load from persisted state if available
  const [sortColumn, setSortColumn] = useState(
    persistedState?.sortColumn || "createdAt",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    persistedState?.sortDirection || "desc",
  );
  const setSort = (column: string, dir: "asc" | "desc") => {
    setSortColumn(column);
    setSortDir(dir);
  };
  // search - load from persisted state if available
  const [search, setSearch] = useState(persistedState?.search || "");
  // filters
  const [roleFilter, setRoleFilter] = useState(
    persistedFilters?.roleFilter || "",
  );
  const [agencyFilter, setAgencyFilter] = useState(
    persistedFilters?.agencyFilter || "",
  );
  const [showArchived, setShowArchived] = useState(
    persistedFilters?.showArchived || false,
  );

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserMobilePhone, setNewUserMobilePhone] = useState("");
  const [newUserCommercialPhone, setNewUserCommercialPhone] = useState("");
  const [newUserCommercialEmail, setNewUserCommercialEmail] = useState("");
  const [newUserOtherDetails, setNewUserOtherDetails] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("COMMERCIAL");
  const [newUserAgencyId, setNewUserAgencyId] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserMobilePhone, setEditUserMobilePhone] = useState("");
  const [editUserCommercialPhone, setEditUserCommercialPhone] = useState("");
  const [editUserCommercialEmail, setEditUserCommercialEmail] = useState("");
  const [editUserOtherDetails, setEditUserOtherDetails] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserCurrentPassword, setEditUserCurrentPassword] = useState("");
  const queryEnabled = options?.queryEnabled ?? true;

  const [profileFullName, setProfileFullName] = useState(
    session?.user.fullName ?? "",
  );
  const [profileEmail, setProfileEmail] = useState(session?.user.email ?? "");

  const clearFeedback = () => {
    setErrorText(null);
    setSuccessText(null);
  };

  // Persist custom users filters (role/agency/archived) across navigation
  useEffect(() => {
    if (!usePersistedState) return;
    if (typeof window === "undefined") return;
    try {
      const nextState: UsersFilterPersistentState = {
        roleFilter,
        agencyFilter,
        showArchived,
      };
      localStorage.setItem("axpo_users_filters", JSON.stringify(nextState));
    } catch {
      // ignore persistence failures
    }
  }, [usePersistedState, roleFilter, agencyFilter, showArchived]);

  // ── TanStack Query ──────────────────────────────────────────────────────
  const queryParams: ListUsersParams = {
    page,
    pageSize,
    search: search || undefined,
    role: roleFilter || undefined,
    agencyId: agencyFilter || undefined,
    orderBy: sortColumn,
    sortDir,
    includeDeleted: showArchived || undefined,
    minimal: minimal || undefined,
    contextual: contextual || undefined,
  };

  const queryKeyParams = normalizeQueryKeyParams({
    page,
    pageSize,
    search,
    role: roleFilter,
    agencyId: agencyFilter,
    orderBy: sortColumn,
    sortDir,
    includeDeleted: showArchived,
    minimal,
    contextual,
  });
  const initialDataKeyParams = options?.initialDataParams
    ? normalizeQueryKeyParams({
        page: options.initialDataParams.page ?? 1,
        pageSize: options.initialDataParams.pageSize ?? initialPageSize,
        search: options.initialDataParams.search ?? "",
        role: options.initialDataParams.role ?? "",
        agencyId: options.initialDataParams.agencyId ?? "",
        orderBy: options.initialDataParams.orderBy ?? "createdAt",
        sortDir: options.initialDataParams.sortDir ?? "desc",
        includeDeleted: options.initialDataParams.includeDeleted ?? false,
        minimal: options.initialDataParams.minimal ?? false,
        contextual: options.initialDataParams.contextual ?? false,
      })
    : null;
  const canUseInitialData =
    !!options?.initialData &&
    !!initialDataKeyParams &&
    JSON.stringify(queryKeyParams) === JSON.stringify(initialDataKeyParams);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["users", session?.token ?? "", queryKeyParams],
    queryFn: async () => {
      const result = await listUsers(session!.token, queryParams);
      // seed the agencyId for the create form if not yet set
      setNewUserAgencyId(
        (curr) =>
          curr || session!.user.agencyId || result.items[0]?.agencyId || "",
      );
      return result;
    },
    enabled: !!session && queryEnabled,
    initialData: canUseInitialData ? options.initialData : undefined,
    initialDataUpdatedAt: canUseInitialData ? Date.now() : undefined,
    placeholderData: keepPreviousData,
    ...cachePolicy,
  });

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const loading = isFetching;

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["users", session?.token ?? ""],
    });
  }, [queryClient, session?.token]);

  const refresh = useCallback(
    async (_overrides?: ListUsersParams) => {
      await refetch();
    },
    [refetch],
  );
  // ────────────────────────────────────────────────────────────────────────

  const runAction = async (id: string, fn: () => Promise<void>) => {
    try {
      setBusyAction(id);
      clearFeedback();
      await fn();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateUser = async (
    e: React.FormEvent,
    data?: {
      name: string;
      email: string;
      mobilePhone: string;
      commercialPhone: string;
      commercialEmail: string;
      maxActiveDevices?: number;
      otherDetails?: string;
      password?: string;
      role: UserRole;
      agencyId: string;
    },
  ): Promise<CreateUserResult | null> => {
    e.preventDefault();
    if (!session) return null;

    const name = data?.name ?? newUserName;
    const email = data?.email ?? newUserEmail;
    const mobilePhone = data?.mobilePhone ?? newUserMobilePhone;
    const commercialPhone = data?.commercialPhone ?? newUserCommercialPhone;
    const commercialEmail = data?.commercialEmail ?? newUserCommercialEmail;
    const maxActiveDevices = data?.maxActiveDevices;
    const otherDetails = data?.otherDetails ?? newUserOtherDetails;
    const password = data?.password ?? newUserPassword;
    const role = data?.role ?? newUserRole;
    const agencyId = data?.agencyId ?? newUserAgencyId;

    if (
      !agencyId ||
      !name.trim() ||
      !email.trim() ||
      !mobilePhone.trim() ||
      !commercialPhone.trim() ||
      !commercialEmail.trim()
    ) {
      setErrorText(
        "Name, email, mobile phone, commercial contact and agency are required.",
      );
      return null;
    }
    if (
      password &&
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,128}$/.test(
        password,
      )
    ) {
      setErrorText(
        "Password must be 12–128 chars with uppercase, lowercase, number and special character.",
      );
      return null;
    }
    if (
      session.user.role === "AGENT" &&
      (role !== "COMMERCIAL" || agencyId !== session.user.agencyId)
    ) {
      setErrorText(
        "Agent can only create commercial users in the same agency.",
      );
      return null;
    }

    let result: CreateUserResult | null = null;
    await runAction("create-user", async () => {
      result = await createUser(session.token, {
        agencyId,
        role,
        fullName: name.trim(),
        email: email.trim(),
        mobilePhone: mobilePhone.trim(),
        commercialPhone: commercialPhone.trim(),
        commercialEmail: commercialEmail.trim(),
        ...(maxActiveDevices ? { maxActiveDevices } : {}),
        otherDetails: otherDetails.trim() || undefined,
        ...(password ? { password } : {}),
      });
      setNewUserName("");
      setNewUserEmail("");
      setNewUserMobilePhone("");
      setNewUserCommercialPhone("");
      setNewUserCommercialEmail("");
      setNewUserOtherDetails("");
      setNewUserPassword("");
      await invalidate();
      setSuccessText(
        result?.generatedPinMasked
          ? `User created. Temporary PIN: ${result.generatedPinMasked}`
          : "User created.",
      );
    });
    return result;
  };

  const openUserEditor = (user: UserItem) => {
    setSelectedUserId(user.id);
    setEditUserName(user.fullName);
    setEditUserEmail(user.email);
    setEditUserMobilePhone(user.mobilePhone ?? "");
    setEditUserCommercialPhone(user.commercialPhone ?? "");
    setEditUserCommercialEmail(user.commercialEmail ?? "");
    setEditUserOtherDetails(user.otherDetails ?? "");
    setEditUserPassword("");
    setEditUserCurrentPassword("");
  };

  const closeUserEditor = () => {
    setSelectedUserId(null);
    setEditUserPassword("");
    setEditUserCurrentPassword("");
  };

  const handleUpdateUser = async (
    e: React.FormEvent,
    data?: {
      userId: string;
      name: string;
      email: string;
      mobilePhone: string;
      commercialPhone: string;
      commercialEmail: string;
      maxActiveDevices?: number;
      otherDetails?: string;
      password?: string;
      currentPassword?: string;
      role?: string;
      agencyId?: string;
      isActive?: boolean;
      preferences?: {
        language?: string | null;
        dateFormat?: string | null;
        timeFormat?: string | null;
        timezone?: string | null;
        numberFormat?: string | null;
        itemsPerPage?: number | null;
      };
    },
  ) => {
    e.preventDefault();
    if (!session) return;

    const userId = data?.userId ?? selectedUserId;
    const name = data?.name ?? editUserName;
    const email = data?.email ?? editUserEmail;
    const mobilePhone = data?.mobilePhone ?? editUserMobilePhone;
    const commercialPhone = data?.commercialPhone ?? editUserCommercialPhone;
    const commercialEmail = data?.commercialEmail ?? editUserCommercialEmail;
    const maxActiveDevices = data?.maxActiveDevices;
    const otherDetails = data?.otherDetails ?? editUserOtherDetails;
    const password = data?.password ?? editUserPassword;
    const currentPassword = data?.currentPassword ?? editUserCurrentPassword;
    const role = data?.role as UserRole | undefined;
    const agencyId = data?.agencyId;
    const isActive = data?.isActive;
    const preferences = data?.preferences;

    if (!userId) return;
    if (
      !name.trim() ||
      !email.trim() ||
      !mobilePhone.trim() ||
      !commercialPhone.trim() ||
      !commercialEmail.trim()
    ) {
      setErrorText(
        "Full name, email, mobile phone and commercial contacts are required.",
      );
      return;
    }
    const changingPassword = password.trim().length > 0;
    if (
      changingPassword &&
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,128}$/.test(
        password,
      )
    ) {
      setErrorText(
        "New password must be 12–128 chars with uppercase, lowercase, number and special character.",
      );
      return;
    }
    if (changingPassword && userId === session.user.id && !currentPassword) {
      setErrorText("Current password is required to change your own password.");
      return;
    }
    await runAction("update-user", async () => {
      await updateUser(session.token, userId, {
        fullName: name.trim(),
        email: email.trim(),
        mobilePhone: mobilePhone.trim(),
        commercialPhone: commercialPhone.trim(),
        commercialEmail: commercialEmail.trim(),
        ...(maxActiveDevices ? { maxActiveDevices } : {}),
        otherDetails: otherDetails?.trim() || "",
        ...(role ? { role } : {}),
        ...(agencyId ? { agencyId } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(preferences ? { preferences } : {}),
        ...(changingPassword
          ? {
              password: password,
              currentPassword:
                userId === session.user.id ? currentPassword : undefined,
            }
          : {}),
      });
      await invalidate();
      setSuccessText(
        changingPassword ? "User and password updated." : "User updated.",
      );
      setSelectedUserId(null);
      setEditUserPassword("");
      setEditUserCurrentPassword("");
    });
  };

  const handleUpdateOwnProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!profileFullName.trim() || !profileEmail.trim()) {
      setErrorText("Full name and email are required.");
      return;
    }
    await runAction("update-profile", async () => {
      await updateUser(session.token, session.user.id, {
        fullName: profileFullName.trim(),
        email: profileEmail.trim(),
      });
      setSuccessText("Profile updated.");
    });
  };

  const handleToggleUserStatus = async (user: UserItem) => {
    await runAction(`toggle-user-${user.id}`, async () => {
      if (!session) return;
      await updateUserStatus(session.token, user.id, !user.isActive);
      await invalidate();
      setSuccessText("User status updated.");
    });
  };

  const handleRotateUserPin = async (
    user: UserItem,
  ): Promise<RotatePinResult | null> => {
    if (!session) return null;
    let result: RotatePinResult | null = null;
    await runAction(`rotate-user-${user.id}`, async () => {
      result = await rotateUserPin(session.token, user.id);
      await invalidate();
      setSuccessText(`PIN rotated: ${result?.newPinMasked}`);
    });
    return result;
  };

  const handleDeleteUser = async (user: UserItem): Promise<void> => {
    if (!session) return;
    await runAction(`delete-user-${user.id}`, async () => {
      await deleteUser(session.token, user.id);
      await invalidate();
      setSuccessText("User deleted.");
    });
  };

  const handleBulkDeleteUsers = async (ids: string[]): Promise<void> => {
    await runAction("bulk-delete-users", async () => {
      if (!session) return;
      await Promise.all(ids.map((id) => deleteUser(session.token, id)));
      await invalidate();
      setSuccessText(
        `${ids.length} user${ids.length !== 1 ? "s" : ""} deleted.`,
      );
    });
  };

  const handleRequestPasswordReset = async (user: UserItem): Promise<void> => {
    if (!session) return;
    await runAction(`request-password-reset-${user.id}`, async () => {
      await requestUserPasswordReset(session.token, user.id);
      setSuccessText(`Password reset email sent to ${user.email}`);
    });
  };

  return {
    users,
    loading,
    busyAction,
    errorText,
    successText,
    clearFeedback,
    refresh,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    sortColumn,
    sortDir,
    setSort,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    agencyFilter,
    setAgencyFilter,
    showArchived,
    setShowArchived,
    newUserName,
    setNewUserName,
    newUserEmail,
    setNewUserEmail,
    newUserPassword,
    setNewUserPassword,
    newUserRole,
    setNewUserRole,
    newUserAgencyId,
    setNewUserAgencyId,
    handleCreateUser,
    selectedUserId,
    editUserName,
    setEditUserName,
    editUserEmail,
    setEditUserEmail,
    editUserPassword,
    setEditUserPassword,
    editUserCurrentPassword,
    setEditUserCurrentPassword,
    openUserEditor,
    closeUserEditor,
    handleUpdateUser,
    profileFullName,
    setProfileFullName,
    profileEmail,
    setProfileEmail,
    handleUpdateOwnProfile,
    handleToggleUserStatus,
    handleRotateUserPin,
    handleRequestPasswordReset,
    handleDeleteUser,
    handleBulkDeleteUsers,
  };
}
