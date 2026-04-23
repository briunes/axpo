import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { AlreadyExistsError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

const createAgencySchema = z.object({
  name: z.string().min(2),
  street: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
});

/**
 * @swagger
 * /api/v1/internal/agencies:
 *   get:
 *     tags: [Agencies]
 *     summary: List agencies
 *     description: List all agencies (Admin sees all, others see only their agency)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 25
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering agencies by name
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [createdAt, name, updatedAt]
 *           default: createdAt
 *         description: Field to order by
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: Agencies listed
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
 *                         allOf:
 *                           - $ref: '#/components/schemas/Agency'
 *                           - type: object
 *                             properties:
 *                               _count:
 *                                 type: object
 *                                 properties:
 *                                   users:
 *                                     type: integer
 *                               users:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     id:
 *                                       type: string
 *                                     fullName:
 *                                       type: string
 *                                     email:
 *                                       type: string
 *                                     role:
 *                                       type: string
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
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10)),
  );
  const search = searchParams.get("search") ?? undefined;
  const includeDeleted =
    searchParams.get("includeDeleted") === "true" &&
    auth.role === UserRole.ADMIN;
  const orderBy = searchParams.get("orderBy") ?? "createdAt";
  const sortDir =
    (searchParams.get("sortDir") ?? "desc") === "asc" ? "asc" : "desc";

  const allowedOrderBy: Record<string, true> = {
    createdAt: true,
    name: true,
    updatedAt: true,
  };
  const safeOrderBy = allowedOrderBy[orderBy] ? orderBy : "createdAt";

  const baseWhere =
    auth.role === UserRole.ADMIN
      ? search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}
      : { id: auth.agencyId };

  const where = {
    ...baseWhere,
    ...(includeDeleted ? {} : { isDeleted: false }), // Only filter out deleted if not including them
  };

  const [agencies, total] = await Promise.all([
    prisma.agency.findMany({
      where,
      orderBy: { [safeOrderBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: { users: true },
        },
        users: {
          where: { role: UserRole.COMMERCIAL },
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.agency.count({ where }),
  ]);

  return ResponseHandler.ok({ items: agencies, total, page, pageSize }, 200);
});

/**
 * @swagger
 * /api/v1/internal/agencies:
 *   post:
 *     tags: [Agencies]
 *     summary: Create agency (Admin only)
 *     description: Create a new agency (Admin role required)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAgencyRequest'
 *     responses:
 *       201:
 *         description: Agency created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Agency'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error or agency already exists
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
 *         description: Forbidden - Admin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN]);

  const body = await request.json();
  const payload = createAgencySchema.parse(body);

  const existing = await prisma.agency.findFirst({
    where: { name: payload.name },
  });
  if (existing) {
    throw new AlreadyExistsError("Agency", "name", payload.name);
  }

  const agency = await prisma.agency.create({
    data: {
      name: payload.name,
      street: payload.street,
      city: payload.city,
      postalCode: payload.postalCode,
      province: payload.province,
      country: payload.country,
    },
  });

  return ResponseHandler.ok(agency, 201);
});
