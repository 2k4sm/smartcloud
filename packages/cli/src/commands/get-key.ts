import { Command } from 'commander'
import { SmartCloudClient } from 'smartcloud-sdk'
import { getBaseUrl, getAccessToken, getProjectId } from '../config'

export function registerGetKeyCommand(program: Command): void {
  program
    .command('get-key')
    .description('Fetch the current active key from a key pool')
    .requiredOption('-n, --name <pool_name>', 'Key pool name')
    .option('-p, --project <project_id>', 'Project ID')
    .action(async (options: { name: string; project?: string }) => {
      try {
        const client = new SmartCloudClient({
          baseUrl: getBaseUrl(),
          accessToken: getAccessToken(),
        })

        const projectId = getProjectId(options.project)
        const value = await client.getPoolKey(projectId, options.name)

        // Output raw value (pipeable)
        process.stdout.write(value)
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
