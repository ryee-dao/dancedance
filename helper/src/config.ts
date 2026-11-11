/**
 * Optional config file next to the helper binary: `dancedance-helper.json`
 *
 *   {
 *     "allowedOrigins": ["https://my-name.github.io", "https://dance.example.com"],
 *     "siteUrl": "https://dance.example.com/",
 *     "allowLocalhost": true
 *   }
 *
 * allowedOrigins are added to the Pages origin baked in at build time.
 * siteUrl replaces the "Open DanceDance" link. allowLocalhost (default true)
 * lets http://localhost:* dev servers use the helper.
 */
import { BUILD } from './build_info.ts';
import { normalizeOrigin } from './policy.ts';

export const CONFIG_FILE = 'dancedance-helper.json';

export interface HelperConfig {
  allowedOrigins: string[];
  siteUrl: string;
  allowLocalhost: boolean;
  warnings: string[];
}

/** Merge the baked defaults with a parsed config file (pure). */
export function resolveConfig(raw: unknown): HelperConfig {
  const warnings: string[] = [];
  const origins = new Set<string>();
  const baked = normalizeOrigin(BUILD.pagesOrigin);
  if (baked) origins.add(baked);
  let siteUrl: string = BUILD.siteUrl;
  let allowLocalhost = true;
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      warnings.push(`${CONFIG_FILE} should contain a JSON object; ignoring it.`);
    } else {
      const r = raw as Record<string, unknown>;
      if (r.allowedOrigins !== undefined) {
        if (!Array.isArray(r.allowedOrigins)) warnings.push('"allowedOrigins" should be a list of addresses.');
        else {
          for (const o of r.allowedOrigins) {
            const n = normalizeOrigin(o);
            if (n) origins.add(n);
            else warnings.push(`Ignoring allowed origin ${JSON.stringify(o)}: use an address like "https://my-name.github.io".`);
          }
        }
      }
      if (r.siteUrl !== undefined) {
        const ok = typeof r.siteUrl === 'string' && normalizeOrigin(r.siteUrl) !== null;
        if (ok) {
          siteUrl = new URL(r.siteUrl as string).href;
          origins.add(normalizeOrigin(r.siteUrl)!);
        } else warnings.push('Ignoring "siteUrl": it must be an http(s) address.');
      }
      if (r.allowLocalhost !== undefined) {
        if (typeof r.allowLocalhost === 'boolean') allowLocalhost = r.allowLocalhost;
        else warnings.push('"allowLocalhost" should be true or false.');
      }
    }
  }
  return { allowedOrigins: [...origins], siteUrl, allowLocalhost, warnings };
}

/** Read the config file at `path` (missing file = defaults). */
export async function loadConfig(path: string): Promise<HelperConfig> {
  let text: string;
  try {
    text = await Deno.readTextFile(path);
  } catch {
    return resolveConfig(undefined);
  }
  try {
    return resolveConfig(JSON.parse(text));
  } catch {
    const c = resolveConfig(undefined);
    c.warnings.push(`${CONFIG_FILE} is not valid JSON; ignoring it.`);
    return c;
  }
}
