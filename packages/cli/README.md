# smartcloud-cli

CLI tool for SmartCloud Secrets Manager.

## Installation

```bash
npm install -g smartcloud-cli
```

## Setup

```bash
# Configure the server URL
smartcloud config --base-url https://your-smartcloud-instance.com

# Authenticate
smartcloud login -e user@example.com
```

## Commands

### `smartcloud login`

Authenticate and save credentials to `~/.smartcloud/auth.json`.

```bash
smartcloud login                    # prompts for email and password
smartcloud login -e user@example.com  # prompts for password only
smartcloud login -u https://custom-url.com  # override base URL
```

### `smartcloud get-secret`

Fetch a single secret value. Output is raw (pipeable).

```bash
smartcloud get-secret -p <project_id> -k DB_PASSWORD
smartcloud get-secret -k API_KEY  # uses default project
```

### `smartcloud env`

Output all secrets as environment variables.

```bash
# dotenv format (default)
smartcloud env -p <project_id> > .env

# Shell export format
eval $(smartcloud env -p <project_id> -f shell)
```

### `smartcloud run`

Run a command with secrets injected as environment variables.

```bash
smartcloud run -p <project_id> -- node app.js
smartcloud run -p <project_id> -- docker compose up
```

### `smartcloud config`

Manage CLI settings stored in `~/.smartcloud/config.json`.

```bash
smartcloud config --base-url https://your-instance.com
smartcloud config --default-project <project_id>
smartcloud config  # display current settings
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SMARTCLOUD_BASE_URL` | Server URL (overrides config file) |
| `SMARTCLOUD_TOKEN` | Access token (overrides saved auth) |
| `SMARTCLOUD_PROJECT` | Default project ID |
