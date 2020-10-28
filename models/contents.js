let Sequelize = require('sequelize');
let db = global.db;

let model = db.define('contents', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  content: { type: Sequelize.TEXT },
  author: { type: Sequelize.STRING(64) },
  public_time: { type: Sequelize.INTEGER },
  extra_info: { type: Sequelize.TEXT }
}, {
  timestamps: false,
  tableName: 'contents'
});

let Model = require('./common');
class Contents extends Model {
  static async create(val) {
    return Contents.fromRecord(Notes.model.build(Object.assign({
      content: '',
      author: '',
      public_time: 0,
      extra_info: ''
    }, val)));
  }

  getModel() { return model; }
};

Notes.model = model;

module.exports = Contents;
