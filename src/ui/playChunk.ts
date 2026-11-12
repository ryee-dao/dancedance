/**
 * Everything behind the home screen that needs the coach: the play screen,
 * the coach stage, Options (its moving previews) and so the whole move
 * library. Building the library (about 1,100 moves) is most of the app's
 * start-up work, so app.ts loads this module with import(): it becomes its
 * own chunk, fetched and run after the home screen is interactive (or when a
 * song is chosen), not before the first paint.
 */

export { createPlay, setStageRenderer } from './play';
export { createCoachStage } from './coachStage';
export { createOptions } from './options';
export { warmGenerator } from '../core/choreo/generator';
// The graphics test's coach rows (graphicsTest.ts).
export { benchStage, benchFigure, warmAll } from './gfxBenchCoach';
