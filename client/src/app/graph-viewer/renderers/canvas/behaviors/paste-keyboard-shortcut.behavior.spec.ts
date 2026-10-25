import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphEdge,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import { CompoundAction, GraphAction } from 'app/graph-viewer/actions/actions';
import { EdgeCreation } from 'app/graph-viewer/actions/edges';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';

import { CanvasGraphView } from '../canvas-graph-view';
import { PasteKeyboardShortcutBehavior, TYPE_STRING } from './paste-keyboard-shortcut.behavior';

function node(hash: string, x: number, y: number): GraphEntity {
  return {
    type: GraphEntityType.Node,
    entity: {hash, display_name: hash, label: 'note', sub_labels: [], data: {x, y}} as UniversalGraphNode,
  };
}

function edge(from: string, to: string): GraphEntity {
  return {type: GraphEntityType.Edge, entity: {from, to, label: 'binds'} as UniversalGraphEdge};
}

describe('PasteKeyboardShortcutBehavior', () => {
  let executed: GraphAction;

  function paste(selection: GraphEntity[]) {
    const graphView = {
      currentHoverPosition: {x: 1000, y: 500},
      execute: (action: GraphAction) => executed = action,
    } as unknown as CanvasGraphView;
    const content = JSON.stringify({type: TYPE_STRING, selection});
    const event = {
      event: {clipboardData: {getData: () => content}, preventDefault: () => {}} as unknown as ClipboardEvent,
    };

    new PasteKeyboardShortcutBehavior(graphView, null).paste(event);

    return (executed as CompoundAction).actions;
  }

  function pastedNodes(actions: GraphAction[]) {
    return actions.filter(action => action instanceof NodeCreation).map(action => (action as NodeCreation).node);
  }

  function pastedEdges(actions: GraphAction[]) {
    return actions.filter(action => action instanceof EdgeCreation).map(action => (action as EdgeCreation).edge);
  }

  it('puts a single node at the cursor', () => {
    const [pasted] = pastedNodes(paste([node('a', 10, 20)]));

    expect([pasted.data.x, pasted.data.y]).toEqual([1000, 500]);
  });

  it('keeps nodes where they were to each other, centred on the cursor', () => {
    const nodes = pastedNodes(paste([node('a', 0, 0), node('b', 200, 100)]));

    expect(nodes.map(({data}) => [data.x, data.y])).toEqual([[900, 450], [1100, 550]]);
  });

  it('gives the copies new hashes', () => {
    const nodes = pastedNodes(paste([node('a', 0, 0), node('b', 200, 100)]));

    expect(nodes.map(({hash}) => hash)).not.toContain('a');
    expect(nodes.map(({hash}) => hash)).not.toContain('b');
    expect(new Set(nodes.map(({hash}) => hash)).size).toBe(2);
  });

  it('connects the copies as the originals were', () => {
    const actions = paste([node('a', 0, 0), node('b', 200, 100), edge('a', 'b')]);
    const [a, b] = pastedNodes(actions);

    expect(pastedEdges(actions).map(({from, to, label}) => [from, to, label])).toEqual([[a.hash, b.hash, 'binds']]);
  });

  it('leaves out an edge to a node that was not copied', () => {
    expect(pastedEdges(paste([node('a', 0, 0), edge('a', 'elsewhere')]))).toEqual([]);
  });

  it('creates the nodes before the edges between them', () => {
    const actions = paste([edge('a', 'b'), node('a', 0, 0), node('b', 200, 100)]);

    expect(actions.map(action => action.constructor)).toEqual([NodeCreation, NodeCreation, EdgeCreation]);
  });
});
