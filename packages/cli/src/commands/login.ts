import { Command } from 'commander'
import * as readline from 'readline'
import { SmartCloudClient } from 'smartcloud-sdk'
import { getBaseUrl, saveAuth } from '../config'

function readPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr, // use stderr so password prompt doesn't mix with piped stdout
    })
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function readLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate with SmartCloud and save credentials')
    .option('-e, --email <email>', 'Email address')
    .option('-u, --url <url>', 'Base URL (overrides config)')
    .action(async (options: { email?: string; url?: string }) => {
      try {
        const baseUrl = options.url || getBaseUrl()
        const email = options.email || await readLine('Email: ')
        const password = await readPassword('Password: ')

        const client = new SmartCloudClient({
          baseUrl,
          email,
          password,
        })

        const token = await client.login()

        saveAuth({ access_token: token, email })
        console.log('Login successful. Token saved to ~/.smartcloud/auth.json')
      } catch (err) {
        console.error('Login failed:', err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
