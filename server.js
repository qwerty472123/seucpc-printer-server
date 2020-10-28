const fs = require('fs');
const fsp = fs.promises;

let cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
global.config = cfg;

const moment = require('moment');
const express = require('express');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const printer = require("@thiagoelg/node-printer");
const pdf = require('html-pdf');
const cheerio = require('cheerio');

const renderer = require('./libs/renderer');
let Contents = null;
let Notes = null;

let app = express();

function markdown(obj, keys, noReplaceUI) {
	let replaceUI = s => {
		if (noReplaceUI) return s;

		s = s.split('<pre>').join('<div class="ui existing segment"><pre style="margin-top: 0; margin-bottom: 0; ">').split('</pre>').join('</pre></div>')
			.split('<table>').join('<table class="ui celled table">')
			.split('<blockquote>').join('<div class="ui message">').split('</blockquote>').join('</div>');

		let cheerio = require('cheerio');
		let $ = cheerio.load('<html><head></head><body></body></html>');
		let body = $('body');
		body.html(s);

		let a = $('img:only-child');
		for (let img of Array.from(a)) {
			if (!img.prev && !img.next) {
				$(img).css('display', 'block');
				$(img).css('margin', '0 auto');
			}
		}

		return body.html();
	};
	return new Promise((resolve, reject) => {
		if (!keys) {
			if (!obj || !obj.trim()) resolve("");
			else renderer.markdown(obj, s => {
				resolve(replaceUI(s));
			});
		} else {
			let res = obj, cnt = keys.length;
			for (let key of keys) {
				renderer.markdown(res[key], (s) => {
					res[key] = replaceUI(s);
					if (!--cnt) resolve(res);
				});
			}
		}
	});
}

function highlight(code, lang) {
	return new Promise((resolve, reject) => {
		renderer.highlight(code, lang, res => {
			resolve(res);
		});
	});
}

function secretEncrypt(secret) {
	if (secret.length > cfg.limits.MAX_SECRET_LENGTH) return '';
	let hash = crypto.createHash('sha256');
	return hash.update(cfg.salt + '|' + secret + '|' + cfg.salt, 'utf8').digest('hex');
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
	res.sendFile(__dirname + "/index.htm");
});

app.post('/login', async (req, res) => {
	try {
		let name = req.body.name;
		if (!cfg.user.hasOwnProperty(name)) throw Error("Username not found");
		if (secretEncrypt(req.body.pwd) !== cfg.user[name].pwd) throw Error("Password not correct");
		res.json({ success: true, message: 'success', data: { jwt: jwt.sign({ name, prt: true }, cfg.jwt, { expiresIn: cfg.expiresIn }) } });
	} catch (err) {
		res.json({ success: false, message: err.message });
	}
});

function jwtVerify(token) {
	try {
		let obj = jwt.verify(token, cfg.jwt);
		if (obj.prt && cfg.user.hasOwnProperty(obj.name)) return true;
		return false;
	} catch (err) {
		console.log(err)
		return false;
	}
}

function jwtGet(token) {
	try {
		let obj = jwt.verify(token, cfg.jwt);
		if (obj.prt && cfg.user.hasOwnProperty(obj.name)) return obj.name;
		return false;
	} catch (err) {
		console.log(err)
		return false;
	}
}

app.post('/verify', async (req, res) => {
	try {
		res.json({ success: true, message: 'verify success', data: { isValid: jwtVerify(req.body.jwt) } })
	} catch (err) {
		res.json({ success: false, message: err.message });
	}
});

app.post('/cfg', async (req, res) => {
	try {
		if (!jwtVerify(req.body.jwt)) throw new Error('not verified');
		let name = jwtGet(req.body.jwt);
		if (!cfg.user.hasOwnProperty(name)) throw Error("Username not found");
		let ans = JSON.parse(JSON.stringify(cfg.global));
		if (cfg.user[name].cfg) ans = Object.assign(ans, cfg.user[name].cfg);
		if (ans.admin) ans.printer = cfg.printer;
		res.json({ success: true, message: 'config get success', cfg: ans });
	} catch (err) {
		res.json({ success: false, message: err.message });
	}
});

app.post('/set_printer', async (req, res) => {
	try {
		if (!jwtVerify(req.body.jwt)) throw new Error('not verified');
		let name = jwtGet(req.body.jwt);
		if (!cfg.user.hasOwnProperty(name)) throw Error("Username not found");
		if (cfg.user[name].cfg.admin) {
			cfg.printer = req.body.printer;
		}
		res.json({ success: true, message: 'config set success' });
	} catch (err) {
		res.json({ success: false, message: err.message });
	}
});

async function doPrint(req, res, buffer, ext, source) {
	try {
		if (!jwtVerify(req.body.jwt)) throw Error("not verified");

		let failed = false;
		let username = jwtGet(req.body.jwt);
		if (!cfg.user.hasOwnProperty(username)) throw Error("Username not found");
		if (ext !== ".pdf") {
			let str = buffer.toString('utf-8');
			let prtname = username;
			if (cfg.user[username].cfg && cfg.user[username].cfg.print) prtname = cfg.user[username].cfg.print;
			buffer = await new Promise(async (resolve, reject) => {
				let base = await fsp.readFile("./libs/assets/assets.html", 'utf-8');
				let paste = '';
				if (ext !== '.md' && ext !== '.markdown') {
					paste = await highlight(str, ext.replace('.', ''));
				} else {
					paste = await markdown(str);
				}
				let $ = cheerio.load('<p class="header">Requester: <b class="cio-req"></b> Source: <span class="cio-source"></span> Time: <span class="cio-time"></span><span style="float: right;">Page: <b>{{page}}</b>/<b>{{pages}}</b></span></p>');
				$('.cio-req').text(prtname);
				$('.cio-source').text(source);
				$('.cio-time').text(moment().format());
				pdf.create(base.replace('<!--Code Paste-->', paste), {
					"header": {
						"height": "8mm",
						"contents": $.html()
					},
					"format": cfg.print.format,
					"border": cfg.print.border,
					"base": url.pathToFileURL(path.join(__dirname, "libs", 'assets', 'assets.html')).href,
					"type": "pdf"
				}).toBuffer(function (err, buffer) {
					if (err) {
						reject(new Error('<b>HTML to PDF</b> 过程出错'));
						return;
					}
					resolve(buffer);
				});
			});
		}

		if (!cfg.user[username].cnt) cfg.user[username].cnt = 1;
		while ((await fsp.access(path.join(__dirname, 'printers', username + '_' + cfg.user[username].cnt + '.pdf'), fs.constants.F_OK).then(_ => true, _ => false))) {
			cfg.user[username].cnt++;
		}
		await fsp.writeFile(path.join(__dirname, 'printers', username + '_' + cfg.user[username].cnt + '.pdf'), buffer);

		{
			let cnt = parseInt(req.body.cnt) || 1;
			if (cnt <= 0) cnt = 1;
			let arr = printer.getPrinters();
			let best = cfg.printer.toLowerCase();
			let cur = null;
			for (let obj of arr) {
				if (cur === null) {
					if (obj.isDefault) cur = obj.name;
					else if (obj.name.toLowerCase().includes(best)) cur = obj.name;
				} else if (obj.isDefault && obj.name.toLowerCase().includes(best)) cur = obj.name;
			}
			let cups = null;
			if (req.body.sides && ["two-sided-short-edge", "two-sided-long-edge", "one-sided"].includes(req.body.sides)) cups = { sides: req.body.sides };
			while (cnt--) {
				await new Promise((resolve, reject) => {
					let options = {
						data: buffer,
						printer: cur,
						type: 'PDF',
						success: function (id) {
							resolve(id);
						},
						error: function (err) {
							reject(err);
						}
					};
					if (cups) options.options = cups;
					printer.printDirect(options);
				}).catch(err => {
					console.log(err)
					res.json({ success: true, message: "prt failed" });
					failed = true;
				});
				if (failed) break;
			}
		}


		if (!failed) res.json({ success: true, message: "print started" });
	} catch (err) {
		res.json({ success: false, message: err.message });
		console.log(err)
	}
}

app.post('/print', multer({ storage: multer.memoryStorage(), limits: { fileSize: cfg.limits.MAX_FILE_SIZE } }).single("pdf"), async (req, res) => {
	await doPrint(req, res, req.file.buffer, path.extname(req.file.originalname), req.file.originalname);
});

app.post('/print_text', async (req, res) => {
	await doPrint(req, res, Buffer.from(req.body.buffer), '.' + req.body.type, 'Paste');
});

let server = null;

if (cfg.https.enable) {
	let credentials = {
		key: fs.readFileSync(cfg.https.key, 'utf8'),
		cert: fs.readFileSync(cfg.https.cert, 'utf8')
	};
	server = require('https').createServer(credentials, app);
} else {
	server = require('http').createServer(app);
}

let io = require('socket.io')(server).of('/chat');

let connections = {};

function randomChoiceInArray(array) {
	return array[Math.floor(Math.random() * array.length)];
}

for (let name in cfg.chat) {
	let val = cfg.chat[name];
	let func = null;
	switch (val.type) {
		case 'group':
			func = () => val.users;
			break;
		case 'best':
			func = () => {
				let all = val.users;
				let conned = [];
				for (let user of all) {
					if (connections.hasOwnProperty(user)) conned.push(user);
				}
				console.log(conned, all)
				if (conned.length > 0) return [randomChoiceInArray(conned)];
				return [randomChoiceInArray(all)];
			};
			break;
		default:
			throw new Error('No such chat type: ' + val.type);
	}
	val.getChats = func;
}

function getTimeSecond() {
	return Math.floor((new Date()).getTime() / 1000);
}

function getChatsByChatName(name) {
	if (cfg.chat.hasOwnProperty(name)) {
		return cfg.chat[name].getChats();
	} else if (cfg.user.hasOwnProperty(name)) return [name];
	return null;
}

async function pushChat(rec) {
	try {
		if (rec.readed) return;
		if (!connections.hasOwnProperty(rec.receiver)) return;
		await rec.loadSource();
		connections[rec.receiver].emit('notify', {
			from: rec.source.author,
			message: rec.source.content,
			public_time: rec.source.public_time,
			remark: rec.source.author + '_' + rec.receiver + '_' + rec.source.public_time,
			extra_info: rec.source.extra_info
		});
		console.log(rec.receiver, {
			from: rec.source.author,
			message: rec.source.content,
			public_time: rec.source.public_time,
			remark: rec.source.author + '_' + rec.receiver + '_' + rec.source.public_time,
			extra_info: rec.source.extra_info
		});
		rec.readed = true;
		await rec.save();
	} catch (err) {
		console.log(err);
		return;
	}
}

async function sendChatByUserName(name, source) {
	if (!cfg.user.hasOwnProperty(name)) return null;
	try {
		let rec = await Notes.create({
			receiver: name,
			readed: false,
			source_id: source.id
		});
		if (connections[name]) await pushChat(rec);
		else await rec.save();
		return rec.readed;
	} catch (err) {
		console.log(err);
		return err;
	}
}

async function sendChatsByChatName(from, name, message, extra_info) {
	let chats = getChatsByChatName(name);
	if (!Array.isArray(chats) || chats.length === 0) {
		return { success: false, reason: '无接收者' };
	}
	for (let user of chats)
		if (!cfg.user.hasOwnProperty(user))
			return { success: false, reason: '接收者不存在' };
	let sended = [], recorded = [];
	let source = await Contents.create({
		content: message,
		author: from,
		public_time: getTimeSecond()
	});
	if (extra_info) source.extra_info = extra_info;
	await source.save();
	for (let user of chats) {
		let result = await sendChatByUserName(user, source);
		if (result === true) sended.push(user);
		else if (result === false) recorded.push(user);
		else return { success: false, reason: '送信异常' };
	}
	return { success: true, sended, recorded };
}

io.on('connect', socket => {
	let cur = null;
	socket.on('register', async jwt => {
		cur = jwtGet(jwt);
		if (cur === false) {
			socket.emit('logout');
			socket.disconnect(true);
		}
		connections[cur] = socket;
		try {
			let arr = await Notes.findAll({
				where: {
					receiver: cur,
					readed: false
				}
			});
			for (let rec of arr) await pushChat(rec);
		} catch (err) {
			console.log(err);
		}
	});
	socket.on('send', async (receiver, message) => {
		if (cfg.user[cur].cfg.chat.indexOf(receiver) === -1) {
			socket.emit('send_back', { success: false, reason: '非授信名称' });
			return;
		}
		socket.emit('send_back', await sendChatsByChatName(cur, receiver, message));
	});
	socket.on('heartbeat', jwt => {
		if (jwtGet(jwt) !== cur) {
			delete connections[cur];
			socket.emit('logout');
			socket.disconnect(true);
		} else socket.emit('heartbeat');
	});
	socket.on('disconnect', () => {
		if (cur) delete connections[cur];
	});
});


require('./models/loader.js')().then(_ => {
	Notes = require('./models/notes.js');
	Contents = require('./models/contents');
	server.listen(cfg.port, () => {
		console.log('Listening...');
	});
});
