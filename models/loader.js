async function loader() {
    let fs = require('fs');
    let Sequelize = require('sequelize');

    const cls = require('cls-hooked');
    const namespace = cls.createNamespace('my-very-own-namespace');
    Sequelize.useCLS(namespace);

    global.db = new Sequelize(global.config.db.database, global.config.db.username, global.config.db.password, {
        host: global.config.db.host,
        dialect: 'mysql',
        logging: false,
        timezone: require('moment')().format('Z')
    });

    global.Promise = require('bluebird');

    global.db.countQuery = async (sql, options) => (await this.db.query(`SELECT COUNT(*) FROM (${sql}) AS \`__tmp_table\``, options))[0][0]['COUNT(*)'];
    global.db.clsNameSpace = namespace;

    await new Promise(resolve => {
        fs.readdir('./models/', (err, files) => {
            if (err) return;
            files.filter((file) => file.endsWith('.js'))
                .filter(file => file != 'common.js' && file != 'loader.js')
                .forEach((file) => require(`./${file}`));
            resolve();
        });
    });
    await global.db.sync();
}

module.exports = loader;