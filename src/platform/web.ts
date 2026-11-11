/** Web (browser / GitHub Pages) implementation of the platform seam. */

import {
  fetchSiteEnrichment,
  fetchVideoInfo,
  limitConcurrency,
  readPlaylistIds,
} from '../player/playlistReader';
import { webHelper } from './helper';
import type { Platform } from './platform';

const oembedSlot = limitConcurrency(4);

export function createWebPlatform(): Platform {
  return {
    id: 'web',
    isTV: false,
    canPlayFiles: true,
    beatmapBase: './',
    liveSync: true,
    localHelper: webHelper(),
    async getPlaylist(listId) {
      const ids = await readPlaylistIds(listId);
      return ids.map((videoId) => ({ videoId }));
    },
    lookupVideo(videoId) {
      return oembedSlot(() => fetchVideoInfo(videoId));
    },
    getEnrichment() {
      return fetchSiteEnrichment();
    },
  };
}
