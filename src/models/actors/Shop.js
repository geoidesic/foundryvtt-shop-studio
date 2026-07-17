import { SHOP_ACTOR_TYPE, SHOP_FLAG_KEYS, SHOP_FLAG_SCOPE } from '~/src/constants/shopConstants';

const {
  ArrayField, BooleanField, DocumentUUIDField, HTMLField, NumberField, SchemaField, StringField
} = foundry.data.fields;

const VARIANCE_PERIODS = Object.freeze(['daily', 'weekly', 'monthly']);

/**
 * Data model for Shop Studio actor subtype data.
 * @extends {foundry.abstract.TypeDataModel}
 */
export class ShopDataModel extends TypeDataModel {
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
      }),
      associatedActors: new ArrayField(
        new StringField({ required: false, blank: true }),
        { initial: () => [] }
      ),
      rollTables: new ArrayField(
        new StringField({ required: false, blank: true }),
        { initial: () => [] }
      ),
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
      )
    };
  }


}
