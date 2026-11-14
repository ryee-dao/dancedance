/** The generated genre vocabulary: built mechanically from Wikidata's subclass graph and the MusicBrainz genre list. */
import { describe, expect, it } from 'vitest';
import { buildVocab, parseSparql, type WdGenre } from './genreVocab';

const g = (id: string, label: string, parents: string[] = [], sitelinks = 10, aliases: string[] = []): WdGenre => ({ id, label, parents, sitelinks, aliases });

describe('buildVocab', () => {
  const graph = [
    g('Q1', 'Latin music'),
    g('Q2', 'tropical music', ['Q1', 'Q9']),
    g('Q3', 'cumbia', ['Q2']),
    g('Q4', 'cumbia sonidera', ['Q3'], 1),
    g('Q5', 'pop music', [], 100, ['pop']),
    g('Q6', 'Latin pop', ['Q5', 'Q1']),
    g('Q9', 'music of Latin America'),
    g('Q7', 'obscure thing', [], 0),
  ];
  const v = buildVocab(graph, ['Cumbia Sonidera', 'K-Pop'], 'now');
  const node = (k: string) => v.wd.find((n) => n[0] === k)!;

  it('depth is the longest subclass chain, not counting regional groupings; desc counts subgenres', () => {
    expect(node('cumbia')[1]).toBe(2); // cumbia -> tropical -> Latin (music of Latin America adds nothing)
    expect(node('latin pop')[1]).toBe(1);
    expect(node('latin')[2]).toBe(4); // tropical, cumbia, cumbia sonidera, Latin pop
    expect(node('cumbia')[3].map((i) => v.wd[i][0])).toEqual(['tropical']);
  });

  it('keeps known genres (sitelinks) and ones MusicBrainz lists, with their ancestors; aliases point at them', () => {
    expect(v.wd.map((n) => n[0])).not.toContain('obscure thing');
    expect(v.wd.map((n) => n[0])).toContain('cumbia sonidera'); // few sitelinks, but MusicBrainz has it
    expect(v.mb).toEqual(['cumbia sonidera', 'k pop']);
    expect(v.wd[v.alias.pop ?? -1]?.[0]).toBeUndefined(); // "pop" is the label key itself
  });

  it('reads the SPARQL answer', () => {
    const rows = parseSparql({
      results: { bindings: [{ g: { value: 'http://www.wikidata.org/entity/Q3' }, l: { value: 'cumbia' }, sl: { value: '34' }, ps: { value: 'http://www.wikidata.org/entity/Q2' }, as: { value: 'cumbia music|kumbia' } }] },
    });
    expect(rows).toEqual([{ id: 'Q3', label: 'cumbia', sitelinks: 34, parents: ['Q2'], aliases: ['cumbia music', 'kumbia'] }]);
  });
});
