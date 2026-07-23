import { Command } from 'commander'
import { spawn } from 'child_process'
import { SmartCloudClient } from '@smartcloud/sdk'
import { getBaseUrl, getAccessToken, getProjectId } from '../config'

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run a command with secrets + key-pool keys injected as environment variables')
    .option('-p, --project <project_id>', 'Project ID')
    .argument('<command...>', 'Command to run')
    .allowExcessArguments(true)
    .action(async (commandArgs: string[], options: { project?: string }) => {
      try {
        const client = new SmartCloudClient({
          baseUrl: getBaseUrl(),
          accessToken: getAccessToken(),
        })

        const projectId = getProjectId(options.project)
        const secrets = await client.getSecrets(projectId)

        const [cmd, ...args] = commandArgs
        const child = spawn(cmd, args, {
          stdio: 'inherit',
          env: { ...process.env, ...secrets },
        })

        child.on('error', (err) => {
          console.error(`Failed to start process: ${err.message}`)
          process.exit(1)
        })

        child.on('exit', (code) => {
          process.exit(code ?? 0)
        })
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
