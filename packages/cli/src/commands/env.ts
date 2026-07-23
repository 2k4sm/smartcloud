import { Command } from 'commander'
import { SmartCloudClient } from '@smartcloud/sdk'
import { getBaseUrl, getAccessToken, getProjectId } from '../config'

export function registerEnvCommand(program: Command): void {
  program
    .command('env')
    .description('Output all secrets and key-pool current keys as environment variables')
    .option('-p, --project <project_id>', 'Project ID')
    .option('-f, --format <format>', 'Output format: dotenv or shell', 'dotenv')
    .action(async (options: { project?: string; format: string }) => {
      try {
        const client = new SmartCloudClient({
          baseUrl: getBaseUrl(),
          accessToken: getAccessToken(),
        })

        const projectId = getProjectId(options.project)
        const secrets = await client.getSecrets(projectId)

        for (const [key, value] of Object.entries(secrets)) {
          if (options.format === 'shell') {
            // Shell export format: eval $(smartcloud env -p <id> -f shell)
            process.stdout.write(`export ${key}=${shellEscape(value)}\n`)
          } else {
            // dotenv format
            process.stdout.write(`${key}=${dotenvEscape(value)}\n`)
          }
        }
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function dotenvEscape(value: string): string {
  if (/[\s"'#\\]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return value
}
