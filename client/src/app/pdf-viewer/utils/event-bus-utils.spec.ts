import { createEventBus } from './event-bus-utils';

class FakeEventBus {
  private listeners = new Map<string, Array<(evt: any) => void>>();

  on(name: string, listener: (evt: any) => void) {
    const registered = this.listeners.get(name) || [];
    this.listeners.set(name, [...registered, listener]);
  }

  dispatch(name: string, evt: any) {
    (this.listeners.get(name) || []).forEach(listener => listener(evt));
  }
}

describe('createEventBus', () => {
  it('should dispatch textlayerrendered on the div of the rendered page text layer', () => {
    // Given a page whose text layer, as in pdf.js 4+, exposes its element as `div`
    const eventBus = createEventBus({EventBus: FakeEventBus}) as unknown as FakeEventBus;
    const textLayerDiv = document.createElement('div');
    const page = {textLayer: {div: textLayerDiv}};
    const received: number[] = [];
    textLayerDiv.addEventListener('textlayerrendered', (event: any) => {
      received.push(event.detail.pageNumber);
    });

    // When pdf.js reports that the text layer of page 3 is rendered
    eventBus.dispatch('textlayerrendered', {source: page, pageNumber: 3});

    // Then the text layer element receives the DOM event for that page
    expect(received).toEqual([3]);
  });
});
