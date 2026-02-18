# @rasika/scripts

Admin CLI for Rasika.life. All commands run inside an SST shell for AWS resource access.

## Usage

```bash
cd packages/scripts

# Dev stage (default)
pnpm cli --help
pnpm cli <command>

# Prod stage
pnpm prod-cli <command>
```

## Commands

### `reindex`

Rebuild and store the search index.

```bash
pnpm cli reindex
```

### `seed:content`

Seed static content pages (about, privacy, terms, etc.).

```bash
pnpm cli seed:content
```

### `seed:admin`

Promote an existing user to admin role.

```bash
pnpm cli seed:admin admin@example.com
```

### `bulk-upload`

Bulk upload compositions from `data/full-normalized.json`.

```bash
# Upload all compositions
pnpm cli bulk-upload

# Upload first 100 compositions
pnpm cli bulk-upload 100

# Drop all data first, then upload
pnpm cli bulk-upload --drop

# Drop and upload first 50
pnpm cli bulk-upload --drop 50
```

**Options:**
- `-d, --drop` - Drop all existing data before uploading
- `[limit]` - Max number of compositions to process (default: all)
