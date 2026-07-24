import { Command } from 'commander'
import { SmartCloudClient } from 'smartcloud-sdk'
import { getBaseUrl, getAccessToken } from '../config'

export function registerProjectsCommand(program: Command): void {
  program
    .command('projects')
    .description('List all projects')
    .action(async () => {
      try {
        const client = new SmartCloudClient({
          baseUrl: getBaseUrl(),
          accessToken: getAccessToken(),
        })

        const projects = await client.listProjects()

        if (projects.length === 0) {
          console.log('No projects found.')
          return
        }

        console.log('ID\tName\tDescription')
        console.log('--\t----\t-----------')
        for (const p of projects) {
          console.log(`${p.id}\t${p.name}\t${p.description || ''}`)
        }
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
