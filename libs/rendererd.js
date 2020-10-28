const renderer = require('@4qwerty7/syzoj-renderer');
const XSS = require('xss');
const xssWhiteList = Object.assign({}, require('xss/lib/default').whiteList);
const path = require('path');
delete xssWhiteList.audio;
delete xssWhiteList.video;

for (const tag in xssWhiteList) {
  xssWhiteList[tag] = xssWhiteList[tag].concat(['style', 'class']);
}

const xss = new XSS.FilterXSS({
  whiteList: xssWhiteList,
  stripIgnoreTag: true,
  onTagAttr: (tag, name, value, isWhiteAttr) => {
    if (tag.toLowerCase() === 'img' && name.toLowerCase() === 'src') {
      if (value.startsWith('data:image/'))
        return name + '="' + XSS.escapeAttrValue(value) + '"';
      else {
        return "";
      }
    }
  }
});

const Redis = require('redis');
const RedisLRU = require('redis-lru');
const util = require('util');
const { pathToFileURL } = require('url');
const redis = Redis.createClient(process.argv[2]);
const redisLru = RedisLRU(redis, parseInt(process.argv[3]));
const redisCache = {
  get(key) {
    return redisLru.get('PRT' + key);
  },
  set(key, value, maxAge) {
    return redisLru.set('PRT' + key, value, maxAge);
  }
};

function markLineNumbers(html) {
  let lines = html.split('\n');
  let id = 0;
  let ans = '<table class="highlight"><tbody>';
  if(lines[lines.length - 1].length < 1) lines.pop();
  for(let line of lines){
    id++;
    ans += `<tr><td class="lineno">${id}: </td><td class="code"><pre>${line}</pre></td></tr>\n`;
  }
  return ans + '</tbody></table>';
}

async function highlight(code, lang) {
  return markLineNumbers(await renderer.highlight(code, lang, redisCache, {
    wrapper: null,
    pygments: {
      options: {
        classprefix: 'pl-'
      }
    }
  }));
}

async function markdown(markdownCode) {
  function filter(html) {
    html = xss.process(html);
    if (html) {
      html = `<div style="position: relative; overflow: hidden; ">${html}</div>`;
    }
    return html;
  };

  return await renderer.markdown(markdownCode, redisCache, filter);
}

process.on('message', async msg => {
  if (msg.type === 'markdown') {
    process.send({
      id: msg.id,
      result: await markdown(msg.source)
    });
  } else if (msg.type === 'highlight') {
    process.send({
      id: msg.id,
      result: await highlight(msg.source.code, msg.source.lang)
    });
  }
});

process.on('disconnect', () => process.exit());