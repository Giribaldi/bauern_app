module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name.startsWith('@typescript-eslint/') || pkg.name === 'typescript-eslint') {
        if (pkg.peerDependencies && pkg.peerDependencies.typescript) {
          pkg.peerDependencies.typescript = '6.0.3'
        }
        if (!pkg.dependencies) pkg.dependencies = {}
        pkg.dependencies.typescript = '6.0.3'
      }
      return pkg
    },
  },
}
