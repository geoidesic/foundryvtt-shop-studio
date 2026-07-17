import { SvelteApplication } from '#runtime/svelte/application';
import { TJSDocument } from '#runtime/svelte/store/fvtt/document';

import ShopSheet from '~/src/components/sheets/ShopSheet.svelte';

export default class SvelteDocumentSheet extends SvelteApplication {
  #documentStore = new TJSDocument(void 0, { delete: this.close.bind(this) });

  constructor(object) {
    super();

    // Ensure options.document is set for Foundry V2 sheet contract
    this.options.document = object;

    // Ensure options.document is set for Foundry V2 sheet contract
    this.options.document = object;

    Object.defineProperty(this.reactive, 'document', {
      get: () => this.#documentStore.get(),
      set: (document) => {
        this.#documentStore.set(document);
      },
    });

    this.reactive.document = object;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 640,
      height: 720,
      resizable: true,
      minimizable: true,
      svelte: {
        class: ShopSheet,
        target: document.body,
        props: function () {
          return { documentStore: this.#documentStore, document: this.reactive.document };
        },
      },
    });
  }
}
