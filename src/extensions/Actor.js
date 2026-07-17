import { MODULE_ID } from '~/src/helpers/constants';

/**
 * ShopActor extends the base Actor document (system-specific, e.g., Actor5e)
 * to provide shop-specific methods and behavior.
 * The isShop getter gates behavior so non-shop actors remain unaffected.
 * @extends {Actor}
 */
export default class ShopActor extends Actor {
  /**
   * Creates a new Shop Actor
   * @param {object} data - The actor data
   * @param {object} context - The initialization context
   */
  constructor(data = {}, context) {
    super(data, context);
  }

  /**
   * Indicates whether the Actor is managed by Shop Studio.
   * @returns {boolean}
   */
  get isShop() {
    const identity = this.getFlag(MODULE_ID, 'identity');
    return identity?.isShop === true || identity?.kind === 'shop-studio.shop';
  }

  /**
   * Retrieves configuration data for this shop.
   * @returns {Record<string, unknown>}
   */
  get shopConfiguration() {
    return this.system?.configuration ?? {};
  }

  /**
   * Updates shop configuration data.
   * @param {Record<string, unknown>} update
   */
  async updateShopConfiguration(update) {
    return this.update({ system: { configuration: foundry.utils.mergeObject(this.shopConfiguration, update ?? {}, { inplace: false }) } });
  }

  /**
   * Returns the persisted stock snapshot.
   * @returns {Array<Record<string, unknown>>}
   */
  get stockSnapshot() {
    return this.system?.stock ?? [];
  }

  /**
   * Persists a new stock snapshot.
   * @param {Array<Record<string, unknown>>} stock
   */
  async setStockSnapshot(stock) {
    return this.update({ system: { stock: stock ?? [] } });
  }

  /**
   * Marks the actor as a shop when the underlying system does not support a custom type.
   * @returns {Promise<foundry.abstract.Document>} update result
   */
  async setShopIdentity() {
    return this.update({ system: { identity: { isShop: true, kind: 'shop-studio.shop' } } });
  }
}