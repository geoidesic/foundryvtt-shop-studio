import { SHOP_ACTOR_TYPE, SHOP_IDENTITY_KIND } from '~/src/constants/shopConstants';

const {
  ArrayField, BooleanField, DocumentUUIDField, HTMLField, NumberField, SchemaField, StringField
} = foundry.data.fields;

const VARIANCE_PERIODS = Object.freeze(['daily', 'weekly', 'monthly']);

/**
 * Base actor data model that provides common functionality for all actor types.
 * @extends {foundry.abstract.TypeDataModel}
 */
class BaseActorModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ required: false, blank: true, initial: '' }),
    };
  }
}

/**
 * Data model for Shop Studio actor subtype data.
 * @extends {BaseActorModel}
 */
export class ShopActorModel extends BaseActorModel {
  /**
   * Defines the schema for shop actor system data.
   * @returns {object} The schema definition object.
   */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      currency: new SchemaField({}),
      configuration: new SchemaField({
        salePriceFactor: new NumberField({ required: true, min: 0, initial: 100 }),
        buyPriceFactor: new NumberField({ required: true, min: 0, initial: 100 }),
        priceVariance: new NumberField({ required: false, min: 0, initial: 10 }),
        variancePeriod: new StringField({
          required: true,
          choices: VARIANCE_PERIODS,
          initial: 'daily'
        }),
        atrophyPercent: new NumberField({ required: false, min: 0, initial: 5 }),
        associatedActors: new ArrayField(
          new StringField({ required: false, blank: true }),
          { initial: () => [] }
        ),
        rollTables: new ArrayField(
          new StringField({ required: false, blank: true }),
          { initial: () => [] }
        )
      }),
      stock: new ArrayField(
        new SchemaField({
          itemId: new StringField({ required: false, blank: true }),
          itemName: new StringField({ required: false, blank: true }),
          basePrice: new NumberField({ required: false, min: 0, initial: 0 }),
          price: new NumberField({ required: false, min: 0, initial: 0 }),
          quantity: new NumberField({ required: false, min: 0, initial: 0 }),
          currency: new StringField({ required: false, blank: true }),
          metadata: new SchemaField({})
        }),
        { initial: () => [] }
      ),
      transactions: new ArrayField(
        new SchemaField({
          itemId: new StringField({ required: false, blank: true }),
          itemName: new StringField({ required: false, blank: true }),
          quantity: new NumberField({ required: false, min: 0, initial: 0 }),
          price: new NumberField({ required: false, min: 0, initial: 0 }),
          total: new NumberField({ required: false, min: 0, initial: 0 }),
          currency: new StringField({ required: false, blank: true }),
          buyerId: new StringField({ required: false, blank: true }),
          buyerName: new StringField({ required: false, blank: true }),
          timestamp: new NumberField({ required: false, min: 0, initial: 0 }),
          metadata: new SchemaField({})
        }),
        { initial: () => [] }
      ),
      identity: new SchemaField({
        isShop: new BooleanField({ required: true, initial: true }),
        kind: new StringField({ required: true, initial: SHOP_ACTOR_TYPE }),
        isEditing: new BooleanField({ required: true, initial: false })
      })
    };
  }

  /**
   * Retrieves shop configuration data from system data.
   * @returns {Record<string, unknown>}
   */
  get shopConfiguration() {
    return this.configuration ?? {};
  }

  /**
   * Updates shop configuration data in system data.
   * @param {Record<string, unknown>} update
   * @returns {Promise<this>}
   */
  async updateShopConfiguration(update) {
    const merged = foundry.utils.mergeObject(this.shopConfiguration, update ?? {}, { inplace: false });
    return this.parent?.update({ system: { configuration: merged } });
  }

  /**
   * Returns the persisted stock snapshot from system data.
   * @returns {Array<Record<string, unknown>>}
   */
  get stockSnapshot() {
    return this.stock ?? [];
  }

  /**
   * Persists a new stock snapshot in system data.
   * @param {Array<Record<string, unknown>>} stock
   * @returns {Promise<this>}
   */
  async setStockSnapshot(stock) {
    return this.parent?.update({ system: { stock: stock ?? [] } });
  }

  /**
   * Updates the shop identity fields.
   * @returns {Promise<this>}
   */
  async setShopIdentity() {
    return this.parent?.update({ system: { identity: { isShop: true, kind: SHOP_ACTOR_TYPE } } });
  }
}
