/// <reference types="node" />
/**
 * The genre sources' HTTP client for Node (the cloud job and the backfill):
 * Node's fetch, real clock, and a generic client name. No personal name,
 * e-mail, URL or repository is sent, only the song's artist and title.
 */
import { PoliteHttp } from '../../src/genre';

export const GENRE_USER_AGENT = 'DanceDance-genre-lookup/1.0';

export function genreHttp(log?: (line: string) => void): PoliteHttp {
  return new PoliteHttp({ fetch: (url, init) => fetch(url, init), userAgent: GENRE_USER_AGENT, log });
}
