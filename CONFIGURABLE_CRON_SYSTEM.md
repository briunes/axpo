# Configurable Cron System for Simulation Expiration

## Overview

The simulation expiration system now includes **database-configurable** settings, allowing you to change the schedule, timezone, and enable/disable the cron job without modifying code or redeploying.

## Features

✅ **Database Configuration** - Schedule, timezone, and enabled state stored in the database  
✅ **Hot Reload** - Changes take effect immediately via API  
✅ **Works Everywhere** - Uses `node-cron` for in-process scheduling (no external dependencies)  
✅ **Validation** - Validates cron expressions and timezones  
✅ **Easy Management** - RESTful API endpoints to view and update settings

## Database Schema

The `SystemConfig` table includes these cron-related fields:

```prisma
model SystemConfig {
  // ... other fields ...

  // Cron job settings
  cronExpirationEnabled     Boolean  @default(true)         // Enable/disable automatic expiration
  cronExpirationSchedule    String   @default("0 2 * * *")  // Cron schedule expression
  cronExpirationTimezone    String   @default("UTC")        // Timezone for execution
}
```

## Default Configuration

- **Enabled**: `true`
- **Schedule**: `0 2 * * *` (Daily at 2:00 AM)
- **Timezone**: `UTC`

## API Endpoints

### Get Cron Configuration

```http
GET /api/v1/internal/system/cron-config
```

**Response:**

```json
{
  "enabled": true,
  "schedule": "0 2 * * *",
  "timezone": "UTC",
  "scheduleDescription": "Daily at 2:00 AM"
}
```

### Update Cron Configuration

```http
PATCH /api/v1/internal/system/cron-config
Content-Type: application/json

{
  "enabled": true,
  "schedule": "0 3 * * *",
  "timezone": "Europe/Madrid"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Cron configuration updated and reloaded",
  "config": {
    "enabled": true,
    "schedule": "0 3 * * *",
    "timezone": "Europe/Madrid",
    "scheduleDescription": "Daily at 3:00 AM"
  }
}
```

**Note:** The cron job is automatically reloaded with the new configuration when you update it via the API.

## Usage Examples

### Using cURL

```bash
# Get current configuration
curl http://localhost:3000/api/v1/internal/system/cron-config

# Change schedule to run every 6 hours
curl -X PATCH http://localhost:3000/api/v1/internal/system/cron-config \
  -H "Content-Type: application/json" \
  -d '{"schedule": "0 */6 * * *"}'

# Change timezone to Madrid
curl -X PATCH http://localhost:3000/api/v1/internal/system/cron-config \
  -H "Content-Type: application/json" \
  -d '{"timezone": "Europe/Madrid"}'

# Disable the cron job
curl -X PATCH http://localhost:3000/api/v1/internal/system/cron-config \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Re-enable with new schedule
curl -X PATCH http://localhost:3000/api/v1/internal/system/cron-config \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "schedule": "0 4 * * *", "timezone": "America/New_York"}'
```

### Using JavaScript/TypeScript

```typescript
// Get configuration
const response = await fetch("/api/v1/internal/system/cron-config");
const config = await response.json();

// Update configuration
const updateResponse = await fetch("/api/v1/internal/system/cron-config", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    schedule: "0 3 * * *",
    timezone: "Europe/Madrid",
  }),
});
```

## Cron Schedule Format

The schedule uses standard cron syntax:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of Week (0-6, Sunday=0)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of Month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Common Schedules

| Schedule       | Description                          |
| -------------- | ------------------------------------ |
| `0 2 * * *`    | Daily at 2:00 AM                     |
| `0 */6 * * *`  | Every 6 hours                        |
| `0 */12 * * *` | Every 12 hours                       |
| `*/30 * * * *` | Every 30 minutes                     |
| `0 0 * * *`    | Daily at midnight                    |
| `0 0 * * 0`    | Weekly on Sunday at midnight         |
| `0 3 * * *`    | Daily at 3:00 AM                     |
| `0 0 1 * *`    | First day of every month at midnight |

### Examples with Timezones

```json
// Daily at 2 AM Madrid time
{
  "schedule": "0 2 * * *",
  "timezone": "Europe/Madrid"
}

// Every 4 hours in New York time
{
  "schedule": "0 */4 * * *",
  "timezone": "America/New_York"
}

// Weekly on Monday at 3 AM Tokyo time
{
  "schedule": "0 3 * * 1",
  "timezone": "Asia/Tokyo"
}
```

## Supported Timezones

Any valid IANA timezone identifier is supported. Common examples:

- **UTC**: `UTC`
- **Europe**: `Europe/Madrid`, `Europe/London`, `Europe/Paris`
- **America**: `America/New_York`, `America/Los_Angeles`, `America/Mexico_City`
- **Asia**: `Asia/Tokyo`, `Asia/Shanghai`, `Asia/Dubai`
- **Pacific**: `Pacific/Auckland`, `Pacific/Fiji`

Full list: [IANA Time Zone Database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

## How It Works

1. **On Startup**: The app loads cron configuration from the database
2. **Validation**: Schedule and timezone are validated before use
3. **Scheduling**: `node-cron` schedules the job with the configured settings
4. **Execution**: At the scheduled time, expired simulations are updated
5. **Hot Reload**: When you update settings via API, cron jobs are automatically reloaded

## Database Migration

The cron configuration fields were added via migration:

```bash
# Migration already applied
pnpm prisma migrate dev --name add_cron_configuration
```

Initial values were set using:

```bash
node scripts/update-cron-config.mjs
```

## Manual Database Updates

You can also update the configuration directly in the database:

```sql
-- Change schedule to daily at 3 AM Madrid time
UPDATE system_config
SET
  "cronExpirationSchedule" = '0 3 * * *',
  "cronExpirationTimezone" = 'Europe/Madrid'
WHERE id = (SELECT id FROM system_config LIMIT 1);
```

**Note:** After manual database changes, restart your server to apply them.

## Monitoring

### Logs

The cron system logs important events:

```
[Cron] Initializing cron jobs...
[Cron] Scheduling simulation expiration: "0 2 * * *" (UTC)
[Cron] All cron jobs initialized successfully
[Cron] Running scheduled simulation expiration job...
[SimulationExpirationService] Expired 5 simulations: ["sim_123", ...]
[Cron] Simulation expiration completed: { totalExpired: 5, duration: "245ms" }
```

### After Configuration Update

```
[Cron] Reloading cron jobs...
[Cron] All cron jobs stopped
[Cron] Initializing cron jobs...
[Cron] Scheduling simulation expiration: "0 3 * * *" (Europe/Madrid)
[Cron] All cron jobs initialized successfully
```

## Troubleshooting

### Cron Not Running

1. Check if it's enabled:

   ```bash
   curl http://localhost:3000/api/v1/internal/system/cron-config
   ```

2. Check logs for initialization errors

3. Verify the schedule is valid:
   ```javascript
   const cron = require("node-cron");
   console.log(cron.validate("0 2 * * *")); // Should be true
   ```

### Invalid Schedule Error

The API will return:

```json
{
  "error": "Invalid cron schedule expression: \"invalid\""
}
```

Fix by providing a valid cron expression.

### Invalid Timezone Error

The API will return:

```json
{
  "error": "Invalid timezone: \"Invalid/Timezone\""
}
```

Use a valid IANA timezone identifier.

## Integration with UI

You can add a settings page in your admin panel to manage cron configuration:

```tsx
// Example React component
function CronSettings() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch("/api/v1/internal/system/cron-config")
      .then((res) => res.json())
      .then(setConfig);
  }, []);

  const updateSchedule = async (newSchedule: string) => {
    const res = await fetch("/api/v1/internal/system/cron-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule: newSchedule }),
    });

    const updated = await res.json();
    setConfig(updated.config);
  };

  return (
    <div>
      <h2>Cron Configuration</h2>
      <p>Current: {config?.scheduleDescription}</p>
      {/* Add form to update schedule, timezone, enabled */}
    </div>
  );
}
```

## Testing

### Test Immediately (Development Only)

Set environment variable to run on startup:

```bash
# .env.local
RUN_CRON_ON_STARTUP=true
```

### Manual Trigger

You can also use the HTTP endpoint:

```bash
curl http://localhost:3000/api/cron/expire-simulations
```

## Best Practices

1. **Production Schedule**: Use off-peak hours (e.g., 2-4 AM)
2. **Timezone Awareness**: Choose timezone matching your business operations
3. **Testing**: Test schedule changes in preview/staging first
4. **Monitoring**: Regularly check logs to ensure cron is running
5. **Disable When Needed**: Use the `enabled` flag to temporarily disable without losing configuration

## Security

- The cron configuration API should be protected (add authentication middleware)
- Only admins should be able to change cron settings
- Validate all input to prevent invalid schedules

## Summary

The configurable cron system provides flexible, database-driven scheduling for simulation expiration:

- ✅ No code changes needed to adjust schedule
- ✅ No redeployment required
- ✅ Hot reload on configuration update
- ✅ Works in all environments
- ✅ Full validation and error handling
- ✅ Easy to manage via API or database

Update the schedule, timezone, or enabled state anytime through the API, and the changes take effect immediately!
