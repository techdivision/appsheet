#!/usr/bin/env node

/**
 * CLI entry point
 */

import { createCLI } from './commands';

const program = createCLI();
program.parse(process.argv);
