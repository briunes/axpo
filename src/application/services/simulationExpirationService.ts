import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationStatus } from "@/domain/types";
import { NotificationService } from "@/application/services/notificationService";

export interface ExpirationResult {
  totalExpired: number;
  expiredIds: string[];
}

/**
 * Service for managing simulation expiration
 */
export class SimulationExpirationService {
  private static async syncExpiringSoonNotifications(daysAhead = 3): Promise<void> {
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const expiringSoon = await prisma.simulation.findMany({
      where: {
        status: SimulationStatus.SHARED,
        expiresAt: {
          gt: now,
          lte: futureDate,
        },
        isDeleted: false,
      },
      select: {
        id: true,
        referenceNumber: true,
        expiresAt: true,
        ownerUserId: true,
        client: {
          select: {
            name: true,
          },
        },
      },
    });

    const results = await Promise.allSettled(
      expiringSoon
        .filter((simulation) => simulation.expiresAt)
        .map((simulation) =>
          NotificationService.notifySimulationExpiringSoon({
            simulationId: simulation.id,
            referenceNumber: simulation.referenceNumber,
            ownerUserId: simulation.ownerUserId,
            clientName: simulation.client?.name,
            expiresAt: simulation.expiresAt as Date,
            daysRemaining: Math.max(
              1,
              Math.ceil((simulation.expiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
            ),
          }),
        ),
    );

    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length > 0) {
      console.error(
        `[SimulationExpirationService] Failed to create ${failed.length} expiring-soon notification(s)`,
        failed.map((result) => (result.status === "rejected" ? result.reason : undefined)),
      );
    }
  }

  /**
   * Finds and expires all simulations that have passed their expiration date
   * @returns Result containing count and IDs of expired simulations
   */
  static async expireSimulations(): Promise<ExpirationResult> {
    const now = new Date();
    await this.syncExpiringSoonNotifications();

    // Find all SHARED simulations that have expired
    const expiredSimulations = await prisma.simulation.findMany({
      where: {
        status: SimulationStatus.SHARED,
        expiresAt: {
          lte: now,
        },
        isDeleted: false,
      },
      select: {
        id: true,
        referenceNumber: true,
        expiresAt: true,
        ownerUserId: true,
        client: {
          select: {
            name: true,
          },
        },
      },
    });

    if (expiredSimulations.length === 0) {
      return {
        totalExpired: 0,
        expiredIds: [],
      };
    }

    const expiredIds = expiredSimulations.map((sim) => sim.id);

    // Use raw SQL so this scheduled status transition does not touch updatedAt.
    await prisma.$executeRaw`
      UPDATE "simulations"
      SET "status" = ${SimulationStatus.EXPIRED}::"SimulationStatus"
      WHERE "id" IN (${Prisma.join(expiredIds)})
    `;

    console.log(
      `[SimulationExpirationService] Expired ${expiredIds.length} simulations:`,
      expiredIds,
    );

    const notificationResults = await Promise.allSettled(
      expiredSimulations.map((simulation) =>
        NotificationService.notifySimulationExpired({
          simulationId: simulation.id,
          referenceNumber: simulation.referenceNumber,
          ownerUserId: simulation.ownerUserId,
          clientName: simulation.client?.name,
          expiresAt: simulation.expiresAt,
        }),
      ),
    );
    const failedNotifications = notificationResults.filter((result) => result.status === "rejected");
    if (failedNotifications.length > 0) {
      console.error(
        `[SimulationExpirationService] Failed to create ${failedNotifications.length} expiration notification(s)`,
        failedNotifications.map((result) => (result.status === "rejected" ? result.reason : undefined)),
      );
    }

    return {
      totalExpired: expiredIds.length,
      expiredIds,
    };
  }

  /**
   * Get count of simulations that will expire soon (within the next N days)
   * @param daysAhead Number of days to look ahead
   * @returns Count of simulations expiring soon
   */
  static async getExpiringCount(daysAhead = 7): Promise<number> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await prisma.simulation.count({
      where: {
        status: SimulationStatus.SHARED,
        expiresAt: {
          gte: now,
          lte: futureDate,
        },
        isDeleted: false,
      },
    });
  }

  /**
   * Get statistics about simulation expiration
   * @returns Statistics object with counts
   */
  static async getExpirationStats() {
    const now = new Date();

    const [alreadyExpired, expiringSoon, activeShared] = await Promise.all([
      // Simulations that should be expired but still have SHARED status
      prisma.simulation.count({
        where: {
          status: SimulationStatus.SHARED,
          expiresAt: {
            lte: now,
          },
          isDeleted: false,
        },
      }),
      // Simulations expiring in the next 7 days
      this.getExpiringCount(7),
      // All active shared simulations
      prisma.simulation.count({
        where: {
          status: SimulationStatus.SHARED,
          expiresAt: {
            gte: now,
          },
          isDeleted: false,
        },
      }),
    ]);

    return {
      alreadyExpired,
      expiringSoon,
      activeShared,
    };
  }
}
