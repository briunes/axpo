# Local Database Setup

This guide helps you set up a local PostgreSQL database in Docker for development, keeping your work separate from the preview database used by the client.

## Quick Start

### 1. Start the Local Database

```bash
# Start PostgreSQL (without pgAdmin UI)
docker-compose up -d

# Or start with pgAdmin UI for database management
docker-compose --profile with-ui up -d
```

### 2. Configure Environment Variables

Copy the local environment template:

```bash
cp .env.local.example .env.local
```

The `.env.local` file is already configured to use the local Docker database. Next.js will automatically use `.env.local` over `.env` when running locally.

### 3. Run Database Migrations

```bash
# Generate Prisma Client
pnpm prisma generate

# Run migrations
pnpm prisma migrate deploy

# Or push schema directly (faster for development)
pnpm prisma db push
```

### 4. Seed the Database

```bash
# Seed with base values and initial data
pnpm seed:runtime

# Optional: Add test data
pnpm seed:test-analytics
```

### 5. Start the Application

```bash
pnpm dev
```

Your app is now running with a local database! 🎉

---

## Database Access

### PostgreSQL Connection Details

- **Host:** localhost
- **Port:** 5432
- **Database:** axpo_simulator
- **User:** axpo
- **Password:** axpo_dev_password

### pgAdmin (Optional Web UI)

If you started with `--profile with-ui`:

- **URL:** http://localhost:5050
- **Email:** admin@axpo.local
- **Password:** admin

To connect to the database in pgAdmin:

1. Right-click "Servers" → "Register" → "Server"
2. **Name:** Axpo Local
3. **Connection tab:**
   - Host: postgres (or localhost if connecting from outside Docker)
   - Port: 5432
   - Database: axpo_simulator
   - Username: axpo
   - Password: axpo_dev_password

### Direct Connection with psql

```bash
# Connect to the database
docker exec -it axpo-postgres-local psql -U axpo -d axpo_simulator

# Or from your host machine (if you have psql installed)
psql postgresql://axpo:axpo_dev_password@localhost:5432/axpo_simulator
```

---

## Useful Commands

### Docker Management

```bash
# View logs
docker-compose logs -f postgres

# Stop database
docker-compose down

# Stop and remove all data (fresh start)
docker-compose down -v
rm -rf docker-data/
```

### Database Management

```bash
# Reset database (drop all tables and re-migrate)
pnpm prisma migrate reset

# Open Prisma Studio (visual editor)
pnpm prisma studio

# Generate Prisma Client after schema changes
pnpm prisma generate

# Create a new migration
pnpm prisma migrate dev --name your_migration_name
```

### Switching Between Databases

The app automatically uses `.env.local` when running locally. To explicitly switch:

```bash
# Use local database (default)
pnpm dev

# Use preview database (override .env.local)
DATABASE_URL="your-preview-db-url" pnpm dev
```

---

## Data Persistence

Database data is stored in `./docker-data/postgres/` on your local machine. This folder is:

- **Git-ignored** (won't be committed)
- **Persistent** (survives container restarts)
- **Deletable** (remove folder to start fresh)

---

## Backup & Restore

### Backup Local Database

```bash
# Create a backup
docker exec axpo-postgres-local pg_dump -U axpo axpo_simulator > backup_$(date +%Y%m%d_%H%M%S).sql

# Or with compressed format
docker exec axpo-postgres-local pg_dump -U axpo -Fc axpo_simulator > backup_$(date +%Y%m%d_%H%M%S).dump
```

### Restore from Backup

```bash
# From SQL file
docker exec -i axpo-postgres-local psql -U axpo -d axpo_simulator < backup.sql

# From dump file
docker exec -i axpo-postgres-local pg_restore -U axpo -d axpo_simulator < backup.dump
```

---

## Troubleshooting

### Port 5432 Already in Use

If you have another PostgreSQL instance running:

```bash
# Change port in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 on host

# Update DATABASE_URL in .env.local
DATABASE_URL=postgresql://axpo:axpo_dev_password@localhost:5433/axpo_simulator
```

### Container Won't Start

```bash
# Check logs
docker-compose logs postgres

# Remove old container and data
docker-compose down -v
rm -rf docker-data/
docker-compose up -d
```

### Prisma Client Issues

```bash
# Regenerate Prisma Client
pnpm prisma generate

# If still having issues, clear node_modules
rm -rf node_modules/.prisma
pnpm prisma generate
```

### Database Out of Sync with Schema

```bash
# Option 1: Reset (destroys data)
pnpm prisma migrate reset

# Option 2: Push schema (tries to preserve data)
pnpm prisma db push --accept-data-loss
```

---

## Best Practices

1. **Always use `.env.local` for local development** - This keeps your preview DB safe
2. **Commit migrations** - Push migration files to Git so team members can sync
3. **Don't commit `.env.local`** - It's already in `.gitignore`
4. **Regular backups** - Before major schema changes, backup your local data
5. **Use Prisma Studio** - Great for quickly viewing and editing data (`pnpm prisma studio`)

---

## Production Considerations

This setup is for **local development only**. For production:

- Use managed PostgreSQL (Supabase, AWS RDS, etc.)
- Set strong passwords
- Enable SSL connections
- Configure proper backup strategy
- Use connection pooling (PgBouncer)
- Monitor performance and logs

---

## Quick Reference

| Task               | Command                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| Start database     | `docker-compose up -d`                                                        |
| Stop database      | `docker-compose down`                                                         |
| View logs          | `docker-compose logs -f`                                                      |
| Connect with psql  | `docker exec -it axpo-postgres-local psql -U axpo -d axpo_simulator`          |
| Run migrations     | `pnpm prisma migrate deploy`                                                  |
| Seed database      | `pnpm seed:runtime`                                                           |
| Open Prisma Studio | `pnpm prisma studio`                                                          |
| Reset database     | `pnpm prisma migrate reset`                                                   |
| Backup database    | `docker exec axpo-postgres-local pg_dump -U axpo axpo_simulator > backup.sql` |

---

**Need help?** Check the [Prisma documentation](https://www.prisma.io/docs) or [Docker Compose docs](https://docs.docker.com/compose/).
