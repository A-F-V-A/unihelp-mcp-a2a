/**
 * Activa los hooks versionados del repositorio. Lo ejecuta `pnpm install`
 * (script `prepare`). No hace nada fuera de un clon de git: dentro de las
 * imagenes Docker no hay `.git` y el build no debe fallar por esto.
 */
const { execSync } = require('node:child_process');
const { chmodSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const raiz = join(__dirname, '..', '..');
const hook = join(__dirname, 'commit-msg');

try {
  execSync('git rev-parse --git-dir', { cwd: raiz, stdio: 'ignore' });
} catch {
  return;
}

if (existsSync(hook)) {
  execSync('git config core.hooksPath tools/git-hooks', { cwd: raiz });
  execSync('git config commit.template tools/git-hooks/plantilla-commit.txt', { cwd: raiz });
  // En Linux y macOS git ignora hooks sin permiso de ejecucion.
  chmodSync(hook, 0o755);
}
