# Decisiones tecnicas de la inicializacion

Registro de las decisiones tomadas al montar el esqueleto del monorepo, con su
justificacion. Sirve para sustentar el capitulo de implementacion del trabajo de
grado y para que un tercero entienda por que el repositorio esta armado asi.

## 1. La raiz del repositorio ES el monorepo

La estructura pedida mostraba una carpeta `unihelp/` conteniendo todo. El
repositorio clonado ya se llama asi, de modo que `apps/`, `libs/`, `experiment/`,
`infra/` y `docs/` viven en la raiz y no en un nivel anidado redundante. Al
clonar, la raiz del clon es el workspace.

## 2. Layout `apps/` + `libs/` con alias, en lugar del layout de paquetes

Nx 23 ofrece dos organizaciones: la clasica (`apps/` + `libs/` con alias de
TypeScript) y la nueva "TS solution" (`packages/` con un `package.json` por
proyecto y project references).

Se eligio la **clasica** porque:

- Coincide con la estructura pedida.
- El modelo mental es mas simple: `@unihelp/dominio` es un alias en
  `tsconfig.base.json`, no un paquete con su propio ciclo de vida.
- Los Dockerfiles quedan mas directos, sin necesidad de resolver referencias
  entre paquetes del workspace dentro de la imagen.

Para un trabajo reproducible por terceros, la simplicidad de lectura pesa mas
que las ventajas de las project references.

## 3. Un solo `node_modules` en desarrollo, dependencias aisladas en la imagen

El requisito de "no mezclar dependencias de las otras tres" se cumple **donde se
evalua**: en la imagen de contenedor.

- **En desarrollo** el workspace comparte un `node_modules` en la raiz. Asi
  funciona un monorepo Nx con pnpm, y es deseable: mantiene una sola version de
  NestJS y de Angular para las cuatro arquitecturas. Si cada arquitectura usara
  versiones distintas del framework, las diferencias medidas ya no vendrian solo
  de la arquitectura.
- **En la imagen** cada Dockerfile copia unicamente `libs/` y su propia carpeta
  de `apps/`, y el `package.json` que emite `nx build`
  (`generatePackageJson: true`) lista solo las dependencias que esa app usa de
  verdad. La imagen de `b0-directo` no contiene nada de B1, B2 ni B3.

Ademas, los tags Nx y `@nx/enforce-module-boundaries` hacen que `pnpm lint`
falle si una arquitectura importa codigo de otra.

## 4. El backend de entrada siempre en el puerto 3000 del host

El frontend es **uno solo** y participa en los cuatro profiles de Compose. Un
servicio de Compose no puede tener un `BACKEND_URL` distinto por profile, asi
que cada arquitectura publica su servicio de entrada en el mismo puerto del
host (`3000`) y el frontend apunta ahi siempre.

Como solo corre un profile a la vez, no hay colision de puertos. Los servicios
internos de B3 y el `mcp-server` conservan sus propios puertos para poder
inspeccionarlos por separado.

## 5. La URL del backend se resuelve en tiempo de EJECUCION

Un `environment.ts` de Angular se compila dentro del bundle y obligaria a una
imagen distinta por arquitectura. En su lugar:

1. El bundle pide `config.json` antes de arrancar (`apps/web/src/main.ts`).
2. Al arrancar el contenedor, `infra/docker/entrypoint-web.sh` reescribe ese
   `config.json` con el valor de la variable `BACKEND_URL`.
3. nginx sirve `config.json` con `Cache-Control: no-store`.

Resultado: **una sola imagen de `web` para las cuatro arquitecturas**, sin
ninguna URL compilada. Hay dos pruebas en `apps/web/src/app/app.spec.ts` que
verifican que el componente consulta la URL configurada y no una fija.

Para desarrollo se acepta ademas `?backend=http://localhost:3002`, que apunta el
mismo frontend a otra arquitectura sin reconstruir.

## 6. `/health` fuera del prefijo `/api`

El endpoint de verificacion vive en `/health` y el resto de la API vivira bajo
`/api`. Se logra con `setGlobalPrefix('api', { exclude: [...] })`. Asi el punto
de verificacion es estable y no se mueve cuando la API se versione.

## 7. El frontend descubre la arquitectura, no la configura

`web` no recibe una variable que le diga "estas en B2". Recibe la URL del
backend, consulta `/health` y **muestra lo que el backend reporta**. Si por
error se levanta otra arquitectura, la UI muestra la real, no la esperada. Un
indicador que se puede configurar mal no sirve para verificar.

## 8. `libs/dominio` define vocabulario, no logica de triaje

La logica de triaje es justamente lo que el experimento compara, asi que
compartirla anularia el estudio. `libs/dominio` contiene solo tipos y catalogos
(areas de servicio, estados, prioridades, catalogo de arquitecturas). Cada
arquitectura implementara su propia coordinacion mas adelante.

## 9. Se retiraron los targets `prune` generados por Nx

El generador `@nx/nest:app` agrega los targets `prune-lockfile`,
`copy-workspace-modules` y `prune`, que asumen un `package.json` por proyecto
(layout de paquetes). En el layout clasico fallan. Se eliminaron de los siete
`project.json` para no dejar targets que rompen al invocarlos. El aislamiento de
dependencias se consigue igual, via el `package.json` que emite `nx build`.

En el runtime de la imagen las dependencias se instalan con
`npm install --omit=dev` a partir de ese `package.json`, cuyas versiones
directas estan fijadas exactamente. No hay lockfile por app, asi que la
resolucion de dependencias transitivas no es bit a bit reproducible; si el
estudio lo exige, se puede generar un lockfile por app en el build.

## 10. `@babel/core` fijado a la 7.x

Angular 22 arrastra `@babel/core` 8, pero `ts-jest` y `jest-preset-angular`
todavia declaran peer `^7`. Sin fijarlo, las pruebas unitarias de Angular no
corren. Se resolvio con un `overrides` en `pnpm-workspace.yaml`. Se puede
retirar cuando `ts-jest` soporte Babel 8.

## 11. `baseUrl` fuera de `tsconfig.base.json`

TypeScript 6 deprecó `baseUrl` (deja de funcionar en TS 7). Los `paths` se
declaran relativos al propio `tsconfig.base.json`, que es el comportamiento
soportado. `rootDir: "."` si se mantiene: es lo que permite que una app importe
codigo de `libs/` sin que `tsc` lo reporte fuera del `rootDir`.

## 12. Un Dockerfile por app

`infra/docker/` tiene un `Dockerfile.<app>` por aplicacion, todos derivados de
una misma plantilla de dos etapas. Se prefirio esto a un unico Dockerfile
parametrizado para que cada artefacto sea autocontenido y legible por separado,
y para poder hacer divergir una arquitectura (por ejemplo, agregarle un runtime
distinto) sin tocar las otras seis.
