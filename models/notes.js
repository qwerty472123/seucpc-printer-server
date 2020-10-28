let Sequelize = require('sequelize');
let db = global.db;

let Contents = require('./contents.js');

let model = db.define('notes', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  receiver: { type: Sequelize.STRING(64) },
  readed: { type: Sequelize.BOOLEAN },
  source_id: { type: Sequelize.INTEGER }
}, {
  timestamps: false,
  tableName: 'notes',
  indexes: [
    {
      fields: ['receiver', 'readed']
    }
  ]
});

let Model = require('./common');
class Notes extends Model {
  static async create(val) {
    return Notes.fromRecord(Notes.model.build(Object.assign({
      receiver: '',
      readed: false,
      source_id: 0
    }, val)));
  }

  async loadSource() {
    if (this.source_id == 0) {
      this.source = await Contents.create();
      return;
    }
    this.source = await Contents.fromID(this.source_id);
  }

  async saveAll() {
    if (this.source) {
      await this.source.save();
      this.source_id = this.source.id;
    }
    await this.save();
  }

  getModel() { return model; }
};

Notes.model = model;

module.exports = Notes;
