// Values baked into the helper binary. scripts/build.ts rewrites this file
// for the duration of a build (from --repo / --version) and restores it after,
// so the committed copy always describes this repository with version "dev".
export const BUILD = {
  version: 'dev',
  repo: 'ryee-dao/dancedance',
  siteUrl: 'https://ryee-dao.github.io/dancedance/',
  pagesOrigin: 'https://ryee-dao.github.io',
} as const;
