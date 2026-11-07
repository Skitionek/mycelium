import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphEdge,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import { CompoundAction, GraphAction } from 'app/graph-viewer/actions/actions';
import { EdgeCreation } from 'app/graph-viewer/actions/edges';
import { uuidv4 } from 'app/shared/utils/identifiers';
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';

import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';

/**
 * We use this string to know that it's our own JSON.
 */
export const TYPE_STRING = 'MyceliumKnowledgeMap/1';

export interface GraphClipboardData {
  type: 'MyceliumKnowledgeMap/1';
  selection: GraphEntity[];
}

/**
 * Implements the paste key.
 */
export class PasteKeyboardShortcutBehavior extends AbstractCanvasBehavior {
  // TODO: fix boundPaste if not coming in next patch
  constructor(private readonly graphView: CanvasGraphView,
              protected readonly dataTransferDataService: DataTransferDataService) {
    super();
  }

  paste(event: BehaviorEvent<ClipboardEvent>): BehaviorResult {
    const position = this.graphView.currentHoverPosition;
    if (position) {
      const content = event.event.clipboardData.getData('text/plain');
      if (content) {
        this.graphView.execute(this.createActionFromPasteContent(content, position));
        event.event.preventDefault();
        return BehaviorResult.Stop;
      }
    }
    return BehaviorResult.Continue;
  }
  /**
   * Returns a node creation action based on the content provided.
   * @param content the content (like from the clipboard)
   * @param position the position of the node
   */
  private createActionFromPasteContent(content: string, position: { x: number, y: number }): GraphAction {
    try {
      const actions = [];
      const data: GraphClipboardData = JSON.parse(content);

      // First try to read the data as JSON
      if (data.type === TYPE_STRING) {
        const nodes = data.selection
          .filter(entry => entry.type === GraphEntityType.Node)
          .map(entry => entry.entity as UniversalGraphNode);
        const edges = data.selection
          .filter(entry => entry.type === GraphEntityType.Edge)
          .map(entry => entry.entity as UniversalGraphEdge);

        // The copies keep where they were to each other, centred on the cursor
        const xs = nodes.map(node => node.data?.x ?? 0);
        const ys = nodes.map(node => node.data?.y ?? 0);
        const dx = position.x - (Math.min(...xs) + Math.max(...xs)) / 2;
        const dy = position.y - (Math.min(...ys) + Math.max(...ys)) / 2;
        const hashes = new Map(nodes.map(node => [node.hash, uuidv4()]));

        for (const node of nodes) {
          actions.push(new NodeCreation(
            `Paste content from clipboard`, {
              ...node,
              hash: hashes.get(node.hash),
              data: {
                ...node.data,
                x: (node.data?.x ?? 0) + dx,
                y: (node.data?.y ?? 0) + dy,
              },
            }, true,
          ));
        }
        // Only edges between copies; the nodes are created first
        for (const edge of edges) {
          if (hashes.has(edge.from) && hashes.has(edge.to)) {
            actions.push(new EdgeCreation(
              `Paste content from clipboard`, {
                ...edge,
                from: hashes.get(edge.from),
                to: hashes.get(edge.to),
              },
            ));
          }
        }
        if (actions.length) {
          return new CompoundAction('Paste content', actions);
        }
      }
    } catch (e) {
      // TODO: throw error?
    }

    return new NodeCreation(
      `Paste content from clipboard`, {
        display_name: 'Note',
        hash: uuidv4(),
        label: 'note',
        sub_labels: [],
        data: {
          x: position.x,
          y: position.y,
          detail: content,
        },
        style: {
          showDetail: true
        }
      }, true,
    );
  }
}
