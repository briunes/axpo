# Simulation Expiration Cron System

This document describes the automated cron system for expiring simulations.

## Overview

The system automatically expires simulations that have passed their `expiresAt` date by:

1. Finding all `SHARED` simulations where `expiresAt <= current time`
2. Updating their status to `EXPIRED`
3. Logging the results for monitoring

## Components

### 1. SimulationExpirationService

Location: `src/application/services/simulationExpirationService.ts`

Core service handling the business logic:

- `expireSimulations()`: Main method that finds and expires simulations
- `getExpiringCount(daysAhead)`: Returns count of simulations expiring in N days
- `getExpirationStats()`: Returns statistics about expiration status

### 2. Cron API Endpoint

Location: `app/api/cron/expire-simulations/route.ts`

REST endpoint that can be triggered by:

- Vercel Cron (automated, recommended)
- External schedulers (GitHub Actions, etc.)
- Manual calls (for testing or recovery)

**Security**: Protected by `CRON_SECRET` environment variable.

### 3. Vercel Cron Configuration

Location: `vercel.json`

Configured to run daily at 2:00 AM UTC:

```json
"crons": [
  {
    "path": "/api/cron/expire-simulations",
    "schedule": "0 2 * * *"
  }
]
```

**Schedule Format**: Standard cron expression (minute hour day month weekday)

- `0 2 * * *` = Every day at 2:00 AM UTC
- `0 */6 * * *` = Every 6 hours
- `0 0 * * 0` = Every Sunday at midnight

## Environment Variables

### CRON_SECRET (Optional but Recommended)

A secret token to secure the cron endpoint from unauthorized access.

**Setup:**

1. Generate a random secret:

   ```bash
   openssl rand -hex 32
   ```

2. Add to your environment:

   ```env
   CRON_SECRET=your_generated_secret_here
   ```

3. In Vercel Dashboard:
   - Go to Project Settings → Environment Variables
   - Add `CRON_SECRET` with your generated value
   - Add for Production, Preview, and Development environments

**Note**: When using Vercel Cron, the secret is optional as Vercel automatically authenticates its own cron jobs. However, it's recommended for additional security and to allow manual testing.

## Usage

### Automated (Vercel Cron)

Once deployed to Vercel, the cron job runs automatically according to the schedule in `vercel.json`. No manual intervention needed.

### Manual Testing (Local Development)

```bash
# Without secret
curl http://localhost:3000/api/cron/expire-simulations

# With secret
curl -H "Authorization: Bearer your_secret_here" \
  http://localhost:3000/api/cron/expire-simulations
```

### Manual Testing (Production)

```bash
curl -H "Authorization: Bearer your_secret_here" \
  https://your-domain.com/api/cron/expire-simulations
```

### Response Format

```json
{
  "success": true,
  "timestamp": "2026-04-21T14:30:00.000Z",
  "duration": "245ms",
  "result": {
    "totalExpired": 5,
    "expiredIds": ["sim_123", "sim_456", "sim_789", "sim_101", "sim_112"]
  },
  "stats": {
    "before": {
      "alreadyExpired": 5,
      "expiringSoon": 12,
      "activeShared": 45
    },
    "after": {
      "alreadyExpired": 0,
      "expiringSoon": 12,
      "activeShared": 45
    }
  }
}
```

## Monitoring

### Vercel Dashboard

- View cron execution logs in Vercel Dashboard → Deployments → Functions
- Each execution is logged with timestamp and result

### Application Logs

The service logs key events:

```
[Cron] Starting simulation expiration job...
[SimulationExpirationService] Expired 5 simulations: ["sim_123", ...]
[Cron] Simulation expiration job completed: { totalExpired: 5, duration: "245ms" }
```

### Error Handling

Errors are logged and returned in the response:

```json
{
  "success": false,
  "error": "Database connection failed",
  "timestamp": "2026-04-21T14:30:00.000Z"
}
```

## Best Practices

1. **Schedule During Low Traffic**: The default 2:00 AM UTC is typically low-traffic
2. **Monitor Regularly**: Check Vercel logs weekly to ensure cron is running
3. **Set Alerts**: Consider setting up alerts for failed cron executions
4. **Test Before Deploy**: Always test the endpoint manually before deploying schedule changes
5. **Keep Logs**: The service logs all expiration activity for audit purposes

## Alternative Schedulers

If not using Vercel, you can trigger the endpoint with:

### GitHub Actions

```yaml
name: Expire Simulations
on:
  schedule:
    - cron: "0 2 * * *"
jobs:
  expire:
    runs-on: ubuntu-latest
    steps:
      - name: Call Cron Endpoint
        run: |
          curl -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-domain.com/api/cron/expire-simulations
```

### Unix Cron

```cron
0 2 * * * curl -H "Authorization: Bearer YOUR_SECRET" https://your-domain.com/api/cron/expire-simulations
```

## Troubleshooting

### Cron Not Running

1. Check Vercel Dashboard → Project Settings → Cron Jobs
2. Verify `vercel.json` is in the repository root
3. Ensure the project is deployed to Vercel (cron only works in production)

### Unauthorized Errors

1. Verify `CRON_SECRET` matches in both code and environment
2. Check the Authorization header format: `Bearer <secret>`

### No Simulations Expiring

1. Check if there are actually simulations with `expiresAt` in the past
2. Verify simulations have `status: SHARED` (not DRAFT or already EXPIRED)
3. Check `isDeleted: false`

## Future Enhancements

Potential improvements to consider:

- Email notifications to users before expiration
- Configurable expiration grace period
- Automatic cleanup of expired simulations after N days
- Metrics dashboard for expiration statistics
- Slack/Discord notifications for cron execution status
