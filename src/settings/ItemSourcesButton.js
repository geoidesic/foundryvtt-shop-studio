import ItemSourcesApp from './ItemSourcesApp.js';

export default class ItemSourcesButton extends FormApplication {
  static showSettings() {
    const sourcesApp = new ItemSourcesApp();
    sourcesApp.render(true, { focus: true });
    return sourcesApp;
  }

  constructor(options = {}) {
    super({}, options);
    ItemSourcesButton.showSettings();
  }

  async _updateObject() {}

  render() {
    this.close();
  }
}
