import { MatchPriority } from 'app/shared/utils/find/prioritised-find';

import { SankeySearch } from './search-match';

function sankeySearch(terms: string[]) {
  // As the Sankey controller sets them: a node's _id is its id, a link's its index
  const nodes = [
    {id: 1, _id: 1, label: 'tp53'},
    {id: 2, _id: 2, label: 'egfr'},
  ];
  const trace = {group: 'path', node_paths: [[1, 2]], detail_edges: [[1, 2]], edges: [0, 1]};
  const links = [
    {_id: 0, description: 'tp53 activates egfr', _trace: trace},
    {_id: 1, description: 'unrelated', _trace: trace},
  ];
  const data = {nodes, links, graph: {trace_networks: [{traces: [{node_paths: [[1, 2]], edges: [0, 1]}]}]}};
  const search = new SankeySearch();
  search.update({data, dataToSearch: {nodes, links}, terms, options: {}});
  return {search, nodes, links};
}

function drain(entity) {
  for (const _ of entity.matchGenerator) {
  }
  return entity.calculatedMatches;
}

describe('SankeySearch', () => {
  it('matches a node every time it is asked about', () => {
    const {search, nodes} = sankeySearch(['tp53']);
    const context = {layers: {}};

    const first = [...search.matchNode(nodes[0] as any, context)];
    const second = [...search.matchNode(nodes[0] as any, context)];

    expect(first.length).toBe(1);
    expect(first[0].priority).toBe(MatchPriority.EXACT_MATCH);
    expect(second).toEqual(first);
  });

  it('matches a link every time it is asked about', () => {
    const {search, links} = sankeySearch(['activates']);
    const context = {layers: {}};

    const first = [...search.matchLink(links[0], context)];
    const second = [...search.matchLink(links[0], context)];

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it('reports the matches of a node found both in view and in a trace network', () => {
    const {search} = sankeySearch(['tp53']);

    const found = [...search.traverseAll()].filter(entity => entity.nodeId === 1);

    expect(found.length).toBe(2);
    for (const entity of found) {
      expect(drain(entity).length).toBe(1);
    }
  });

  it('does not repeat the matches of a trace reached through several links', () => {
    const {search, links} = sankeySearch(['tp53']);
    const context = {layers: {}};

    const viaFirst = [...search.matchLink(links[1], context)];
    const viaSecond = [...search.matchLink(links[1], context)];

    // The link's own text does not match; everything found is on its trace
    expect(viaFirst.every(match => match.path[0] === 'trace')).toBeTrue();
    expect(viaFirst.length).toBeGreaterThan(0);
    expect(viaSecond).toEqual(viaFirst);
  });
});
