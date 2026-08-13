import 'reflect-metadata';
import assert = require('node:assert/strict');
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Test } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../src/app.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';

// This test exists because a source-only decorator check (test:p0-auth-control-entry)
// already proved every guarded controller carries @UseGuards(JwtAuthGuard, ...), yet
// the backend still failed to boot: UnknownDependenciesException, JwtService not
// available in TenantModule. A controller can declare a guard class while its owning
// module never imports the module that actually provides that guard's dependencies --
// decorator presence alone cannot catch that. Only asking Nest to build the real
// dependency-injection graph (Test.createTestingModule({ imports: [AppModule] }).compile())
// exercises the same resolution path that failed at container boot in RC-FIX-1A.

type Test_ = { name: string; run: () => void | Promise<void> };
const tests: Test_[] = [];
const test = (name: string, run: Test_['run']) => tests.push({ name, run });

test('the full AppModule dependency-injection graph compiles without error (real Nest bootstrap, no HTTP listener)', async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  await moduleRef.close();
});

// Fast secondary guard: every controller directly using @UseGuards(JwtAuthGuard...) must
// live in a module that either imports AuthModule (transitively or directly is NOT
// sufficient -- Nest does not cascade unexported imports, so this only accepts a direct
// import) or, for AuthModule's own controller, is AuthModule itself. This is a cheap
// early signal; the compile test above is the actual proof.
test('every JwtAuthGuard-guarded controller\'s module directly imports AuthModule (or is AuthModule)', () => {
  const srcRoot = path.join(__dirname, '..', 'src', 'modules');
  const offenders: string[] = [];

  for (const moduleName of fs.readdirSync(srcRoot)) {
    const moduleDir = path.join(srcRoot, moduleName);
    if (!fs.statSync(moduleDir).isDirectory()) continue;

    const controllerFiles = fs.readdirSync(moduleDir).filter((f) => f.endsWith('.controller.ts'));
    const guardedControllers = controllerFiles.filter((f) => {
      const text = fs.readFileSync(path.join(moduleDir, f), 'utf8');
      return /UseGuards\([^)]*JwtAuthGuard/.test(text);
    });
    if (guardedControllers.length === 0) continue;

    const moduleFile = fs.readdirSync(moduleDir).find((f) => f.endsWith('.module.ts'));
    if (!moduleFile) {
      offenders.push(`${moduleName}: has guarded controller(s) [${guardedControllers.join(', ')}] but no *.module.ts found`);
      continue;
    }

    const moduleText = fs.readFileSync(path.join(moduleDir, moduleFile), 'utf8');
    const isAuthModuleItself = moduleFile === 'auth.module.ts';
    const importsBlockMatch = moduleText.match(/imports\s*:\s*\[([\s\S]*?)\]/);
    const importsAuthModule = importsBlockMatch ? /\bAuthModule\b/.test(importsBlockMatch[1]) : false;

    if (!isAuthModuleItself && !importsAuthModule) {
      offenders.push(`${moduleName}/${moduleFile}: guards [${guardedControllers.join(', ')}] with JwtAuthGuard but imports array does not include AuthModule`);
    }
  }

  assert.deepEqual(offenders, [], `modules with a JwtAuthGuard-guarded controller but no AuthModule import:\n${offenders.join('\n')}`);
});

test('AuthModule is not @Global() (explicit imports remain required, no shortcut taken)', () => {
  const authModuleText = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'auth', 'auth.module.ts'), 'utf8');
  assert.doesNotMatch(authModuleText, /@Global\(\)/);
});

test('JwtAuthGuard remains provided and exported by AuthModule (single ownership, not duplicated elsewhere)', () => {
  const authModuleText = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'auth', 'auth.module.ts'), 'utf8');
  assert.match(authModuleText, /providers:\s*\[[^\]]*JwtAuthGuard/);
  assert.match(authModuleText, /exports:\s*\[[^\]]*JwtAuthGuard/);
  assert.equal(typeof JwtAuthGuard, 'function');
  assert.equal(typeof AuthModule, 'function');
});

async function main() {
  let passed = 0;
  for (const item of tests) {
    try {
      await item.run();
      passed++;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      console.error(`FAIL ${item.name}`, error);
      process.exitCode = 1;
    }
  }
  console.log(`AUTH MODULE WIRING: ${passed}/${tests.length} PASS`);
  if (passed !== tests.length) process.exitCode = 1;
}

void main();
