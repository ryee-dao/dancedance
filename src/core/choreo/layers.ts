/**
 * The layer-pattern registry (footwork, arms, torso/head accents), filled from
 * the family files (families/*.ts). See catalog.ts for the Pattern format and
 * AUTHORING.md for how to write patterns.
 */

import './families/index';

export { ACCENT, ARMS, FOOT, PATTERN_FILE, type Pattern } from './catalog';
