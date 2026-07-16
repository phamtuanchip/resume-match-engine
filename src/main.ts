import 'reflect-metadata';
import { CommandFactory } from 'nest-commander';
import { DomainError } from '@common/errors';
import { CliUsageError } from '@presentation/cli/commands/cli-options';
import { AppModule } from './app.module';

/**
 * CLI analogue of a global exception filter: domain errors print as
 * `ERROR [CODE]: message`, anything else as unexpected; both exit non-zero.
 */
function handleError(err: Error): void {
  if (err instanceof CliUsageError) {
    console.error(`ERROR: ${err.message}`);
  } else if (err instanceof DomainError) {
    console.error(`ERROR [${err.code}]: ${err.message}`);
  } else {
    console.error(`ERROR [UNEXPECTED]: ${err.message}`);
  }
  process.exitCode = 1;
}

async function bootstrap(): Promise<void> {
  await CommandFactory.run(AppModule, {
    logger: ['error'],
    errorHandler: handleError, // commander usage errors
    serviceErrorHandler: handleError, // errors thrown from commands / use cases
  });
}

// A rejection from bootstrap itself (e.g. DI/container failure before CommandFactory's own
// handlers engage) would otherwise be an unhandled promise rejection — route it through the
// same handler so it prints cleanly and sets a non-zero exit code.
bootstrap().catch(handleError);
