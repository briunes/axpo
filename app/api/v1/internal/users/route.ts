import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import {
  assertPermission,
  isElevatedRole,
} from "@/application/middleware/rbac";
import { AuthService } from "@/application/services/authService";
import { prisma } from "@/infrastructure/database/prisma";
import { parseCreateUserPayload } from "./userPayloadValidation";

/**
 * @swagger
 * /api/v1/internal/users:
 *   get:
 *     tags: [Users]
 *     summary: List users (Admin or Agent)
 *     description: List users based on role (Admin sees all, Agent sees agency's, Commercial not allowed)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 25
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, AGENT, COMMERCIAL]
 *         description: Filter by role
 *       - in: query
 *         name: agencyId
 *         schema:
 *           type: string
 *         description: Filter by agency ID
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [createdAt, fullName, email]
 *           default: createdAt
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Users listed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Commercial users cannot list users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  const sp = request.nextUrl.searchParams;
  const contextual = sp.get("contextual") === "true";

  // Agents need agency user names for operational filters and audit dialogs,
  // without receiving access to the Users management module.
  if (!(contextual && auth.role === UserRole.AGENT)) {
    await assertPermission(auth, "users.view");
  }

  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(sp.get("pageSize") || "25", 10)),
  );
  const search = sp.get("search") || undefined;
  const roleFilter = sp.get("role") || undefined;
  const agencyIdFilter = sp.get("agencyId") || undefined;
  const includeDeleted =
    sp.get("includeDeleted") === "true" && isElevatedRole(auth.role);
  const rawOrderBy = sp.get("orderBy") || "createdAt";
  const sortDir: "asc" | "desc" = sp.get("sortDir") === "asc" ? "asc" : "desc";
  // minimal=true: skip all includes/joins. Used by dropdowns that only need id + name.
  const minimal =
    sp.get("minimal") === "true" ||
    (contextual && auth.role === UserRole.AGENT);

  const allowedOrderBy: Record<string, string> = {
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    fullName: "fullName",
    email: "email",
    role: "role",
  };
  const orderByField = allowedOrderBy[rawOrderBy] ?? "createdAt";

  const baseWhere = isElevatedRole(auth.role)
    ? {}
    : { agencyId: auth.agencyId };
  const searchWhere = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const roleWhere = roleFilter ? { role: roleFilter as UserRole } : {};
  const agencyWhere =
    agencyIdFilter && isElevatedRole(auth.role)
      ? { agencyId: agencyIdFilter }
      : {};
  const where = {
    ...baseWhere,
    ...searchWhere,
    ...roleWhere,
    ...agencyWhere,
    ...(includeDeleted ? {} : { isDeleted: false }),
  };

  if (minimal) {
    // Lean query: no joins. Used for dropdown/select UI.
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          agencyId: true,
          role: true,
          fullName: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { [orderByField]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return ResponseHandler.ok({ items: users, total, page, pageSize }, 200);
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        agencyId: true,
        role: true,
        fullName: true,
        email: true,
        mobilePhone: true,
        commercialPhone: true,
        commercialEmail: true,
        otherDetails: true,
        maxActiveDevices: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        pinRotatedAt: true,
        createdByUser: { select: { id: true, fullName: true } },
        updatedByUser: { select: { id: true, fullName: true } },
      },
      orderBy: { [orderByField]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return ResponseHandler.ok({ items: users, total, page, pageSize }, 200);
});

/**
 * @swagger
 * /api/v1/internal/users:
 *   post:
 *     tags: [Users]
 *     summary: Create a user (Admin or Agent with restrictions)
 *     description: Create a new user (Admin can create any, Agent can only create COMMERCIAL in their agency)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "users.create");

  const body = await request.json();
  const payload = await parseCreateUserPayload(body);

  AuthService.enforceCreatePermissions(
    { role: auth.role, agencyId: auth.agencyId },
    payload,
  );

  const agency = await prisma.agency.findUnique({
    where: { id: payload.agencyId },
  });
  if (!agency) {
    throw new ValidationError("Agency not found");
  }

  const created = await AuthService.createUser({
    ...payload,
    createdByUserId: auth.userId,
  });
  return ResponseHandler.ok(created, 201);
});
