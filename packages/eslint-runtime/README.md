# ESLint runtime

This private workspace isolates the temporary TypeScript 6.0.3 compatibility layer required by `typescript-eslint` 8.64.0.

Application and shared-package builds and typechecks use only TypeScript 7.0.2. Do not import this package from application code or use its compiler for builds or typechecks.
