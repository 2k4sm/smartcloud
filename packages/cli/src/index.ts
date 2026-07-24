#!/usr/bin/env node

import { Command } from 'commander'
import { registerLoginCommand } from './commands/login'
import { registerGetSecretCommand } from './commands/get-secret'
import { registerGetKeyCommand } from './commands/get-key'
import { registerEnvCommand } from './commands/env'
import { registerRunCommand } from './commands/run'
import { registerConfigCommand } from './commands/config'
import { registerProjectsCommand } from './commands/projects'

const program = new Command()

program
  .name('smartcloud')
  .description('SmartCloud Secrets Manager CLI')
  .version('0.9.0')

registerLoginCommand(program)
registerProjectsCommand(program)
registerGetSecretCommand(program)
registerGetKeyCommand(program)
registerEnvCommand(program)
registerRunCommand(program)
registerConfigCommand(program)

program.parse()
