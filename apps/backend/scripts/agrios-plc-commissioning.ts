import { CommissioningCli } from '../src/modules/device-control/commissioning/commissioning-cli';

void new CommissioningCli().run(process.argv.slice(2)).then((result) => {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
