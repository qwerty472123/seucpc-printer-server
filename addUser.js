const fsp = require('fs').promises;
const crypto = require('crypto');

(async function() {
    if(process.argv.length != 4) return console.log('Usage: node adduser.js <user> <pwd>');
    let cfg = JSON.parse(await fsp.readFile("config.json", "utf-8"));
    function secretEncrypt(secret) {
        if(secret.length > cfg.limits.MAX_SECRET_LENGTH) return '';
        let hash = crypto.createHash('sha256');
        return hash.update(cfg.salt + '|' + secret + '|' + cfg.salt, 'utf8').digest('hex');
    }
    let user = process.argv[2], pwd = secretEncrypt(process.argv[3]);
    cfg.user[user] = {pwd};
    await fsp.writeFile('config.json', JSON.stringify(cfg, null, '\t'), 'utf8');
    console.log('User added!');
})();