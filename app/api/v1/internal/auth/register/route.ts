import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { AuthService } from "@/application/services/authService";
import { prisma } from "@/infrastructure/database/prisma";

const registerSchema = z.object({
  agencyId: z.string().min(1),
  role: z.nativeEnum(UserRole),
  fullName: z.string().min(2),
  email: z.string().email(),
  mobilePhone: z.string().min(1),
  commercialPhone: z.string().min(1),
  commercialEmail: z.string().email(),
  otherDetails: z.string().max(5000).optional(),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/),
  pin: z.string().regex(/^\d+$/).optional(),
});

/**
 * @swagger
 * /api/v1/internal/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register user account (Admin or Agent with restrictions)
 *     description: Create a new user account (Admin only or Agent creating COMMERCIAL in their agency)
 *     deprecated: true
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agencyId, role, fullName, email, mobilePhone, commercialPhone, commercialEmail, password]
 *             properties:
 *               agencyId:
 *                 type: string
 *                 format: uuid
 *               role:
 *                 type: string
 *                 enum: [ADMIN, AGENT, COMMERCIAL]
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *               email:
 *                 type: string
 *                 format: email
 *               mobilePhone:
 *                 type: string
 *               commercialPhone:
 *                 type: string
 *               commercialEmail:
 *                 type: string
 *                 format: email
 *               otherDetails:
 *                 type: string
 *                 maxLength: 5000
 *               password:
 *                 type: string
 *                 minLength: 12
 *                 maxLength: 128
 *                 pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$'
 *                 description: Must contain uppercase, lowercase, digit, and special character
 *               pin:
 *                 type: string
 *                 pattern: '^\d+$'
 *     responses:
 *       201:
 *         description: User registered
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
 *         description: Validation error or insufficient permissions
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
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "users.create");

  const body = await request.json();
  const payload = registerSchema.parse(body);

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

  const created = await AuthService.createUser(payload);
  return ResponseHandler.ok(created, 201);
});
