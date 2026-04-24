import { prisma } from "@/infrastructure/database/prisma";
import { SimulationStatus } from "@/domain/types";

export interface ExpirationResult {
  totalExpired: number;
  expiredIds: string[];
}

/**
 * Service for managing simulation expiration
 */
export class SimulationExpirationService {
  /**
   * Finds and expires all simulations that have passed their expiration date
   * @returns Result containing count and IDs of expired simulations
   */
  static async expireSimulations(): Promise<ExpirationResult> {
    const now = new Date();

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
        expiresAt: true,
        agencyId: true,
        ownerUserId: true,
      },
    });

    if (expiredSimulations.length === 0) {
      return {
        totalExpired: 0,
        expiredIds: [],
      };
    }

    const expiredIds = expiredSimulations.map((sim) => sim.id);

    // Update all expired simulations to EXPIRED status
    await prisma.simulation.updateMany({
      where: {
        id: {
          in: expiredIds,
        },
      },
      data: {
        status: SimulationStatus.EXPIRED,
        updatedAt: now,
      },
    });

    console.log(
      `[SimulationExpirationService] Expired ${expiredIds.length} simulations:`,
      expiredIds,
    );

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
