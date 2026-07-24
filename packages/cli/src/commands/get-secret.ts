import { Command } from 'commander'
import { SmartCloudClient } from 'smartcloud-sdk'
import { getBaseUrl, getAccessToken, getProjectId } from '../config'

export function registerGetSecretCommand(program: Command): void {
  program
    .command('get-secret')
    .description('Fetch a single secret value')
    .requiredOption('-k, --key <key_name>', 'Secret key name')
    .option('-p, --project <project_id>', 'Project ID')
    .action(async (options: { key: string; project?: string }) => {
      try {
        const client = new SmartCloudClient({
          baseUrl: getBaseUrl(),
          accessToken: getAccessToken(),
        })

        const projectId = getProjectId(options.project)
        const value = await client.getSecret(projectId, options.key)

        // Output raw value (pipeable)
        process.stdout.write(value)
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
