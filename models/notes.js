let Sequelize = require('sequelize');
let db = global.db;

let model = db.define('notes', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  content: { type: Sequelize.TEXT },
  author: { type: Sequelize.STRING(64) },
  receiver: { type: Sequelize.STRING(64) },
  public_time: { type: Sequelize.INTEGER },
  readed: { type: Sequelize.BOOLEAN }
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
      content: '',
      author: '',
      receiver: '',
      public_time: 0,
      readed: false
    }, val)));
  }

  getModel() { return model; }
};

Notes.model = model;

module.exports = Notes;
