// Licence: PUBLIC DOMAIN <http://unlicense.org/>
// Author: Austin Wright <http://github.com/Acubed>

var MediaType = module.exports = function MediaType(s, p) {
  this.type = "";
  this.params = {};

  if (typeof s === "string") {
    var c = splitQuotedString(s);

    this.type = c.shift();

    for (var i=0;i<c.length;++i) {
      this.parseParameter(c[i]);
    }
  } else if (s instanceof MediaType) {
    this.type = s.type;

    this.q = s.q;

    for (var n in s.params) {
      this.params[n] = s.params[n];
    }
  }

  if (typeof p === "string") {
    var c = splitQuotedString(p);

    for(var i=0;i<c.length;++i){
      this.parseParameter(c[i]);
    }
  } else if (typeof p === "object") {
    for (var n in p) {
      this.params[n] = p[n];
    }
  }
};

MediaType.prototype.parseParameter = function parseParameter(s){
  var param = s.split("=", 1);

  var name = param[0].trim();

  var value = s.substr(param[0].length + 1).trim();

  if (!value || !name) {
    return;
  }

  if (name === "q" && typeof this.q === "undefined"){
    this.q = parseFloat(value);
  } else {
    if (value[0] === '"' && value[value.length - 1] === '"'){
      value = value.substr(1, value.length - 2).replace(/\\(.)/g, function(a, b) {
        return b;
      });
    }

    this.params[name] = value;
  }
};

MediaType.prototype.toString = function toString() {
  var str = this.type;

  if (typeof this.q !== "undefined") {
    str += ";q=" + this.q;
  }

  var params = Object.keys(this.params).sort();

  for (var i=0;i<params.length;++i) {
    var n = params[i];

    str += ";" + n + '="' + this.params[n].replace(/["\\]/g, function(a) {
      return "\\" + a;
    }) + '"';
  }

  return str;
};

// Split a string by character, but ignore quoted parts and backslash-escaped
// characters
var splitQuotedString = MediaType.splitQuotedString = function splitQuotedString(str, delim, quote) {
  delim = delim || ";";
  quote = quote || '"';

  var res = [];

  var start = 0;
  var offset = 0;

  var findNextChar = function findNextChar(v, c, i, a){
    var p = str.indexOf(c, offset + 1);

    return (p < 0) ? v : Math.min(p, v);
  };

  while (offset >= 0) {
    offset = [delim, quote].reduce(findNextChar, 1 / 0);

    if (offset === 1 / 0) {
      break;
    }

    switch (str[offset]) {
      case quote:
        // Skip to end of quoted string
        while(1) {
          offset = str.indexOf(quote, offset + 1);

          if (offset < 0) {
            break;
          }

          if (str[offset - 1] === "\\") {
            continue;
          }

          break;
        }

        continue;
      case delim:
        res.push(str.substr(start, offset - start).trim());

        start = ++offset;

        break;
    }
  }

  res.push(str.substr(start).trim());

  return res;
};

// Split a list of content types found in an Accept header
// Maybe use it like: splitContentTypes(request.headers.accept).map(parseMedia)
var splitContentTypes = MediaType.splitContentTypes = function splitContentTypes(str){
  return splitQuotedString(str, ",");
};

var parseMedia = MediaType.parseMedia = function parseMedia(str){
  var o = new MediaType(str);

  if (typeof o.q === "undefined") {
    o.q = 1;
  }

  return o;
};

// Pick an ideal representation to send given a list of representations
// to choose from and the client-preferred list
var select = MediaType.select = function select(reps, accept) {
  var cr = {q: 0},
      ca = {q: 0},
      cq = 0;

  for (var i=0;i<reps.length;++i) {
    var r = reps[i];
    var rq = r.q || 1;

    for (var j=0;j<accept.length;++j){
      var a=accept[j];
      var aq = a.q || 1;

      var cmp = mediaCmp(a, r);

      if (cmp !== null && cmp >= 0){
        if (aq * rq > cq) {
          ca = a;
          cr = r;
          cq = ca.q * cr.q;
          if (cq===1 && cr.type) {
            return cr;
          }
        }
      }
    }
  }

  return cr.type && cr;
};

// Determine if one media type is a subset of another
// If a is a superset of b (b is smaller than a), return 1
// If b is a superset of a, return -1
// If they are the exact same, return 0
// If they are disjoint, return null
var mediaCmp = MediaType.mediaCmp = function mediaCmp(a, b) {
  if (a.type === "*/*" && b.type !== "*/*") {
    return 1;
  } else if (a.type !== "*/*" && b.type === "*/*") {
    return -1;
  }

  var ac = (a.type || "").split("/");
  var bc = (b.type || "").split("/");

  if (ac[0] === "*" && bc[0] !== "*") {
    return 1;
  }

  if (ac[0] !== "*" && bc[0] === "*") {
    return -1;
  }

  if (a.type !== b.type) {
    return null;
  }

  var ap = a.params || {};
  var bp = b.params || {};

  var ak = Object.keys(ap);
  var bk = Object.keys(bp);

  if (ak.length < bk.length) {
    return 1;
  }

  if (ak.length > bk.length) {
    return -1;
  }

  var k = ak.concat(bk).sort();

  var dir = 0;

  for (var n in ap) {
    if (ap[n] && typeof bp[n] === "undefined") {
      if (dir < 0) {
        return null;
      } else {
        dir = 1;
      }
    }

    if (bp[n] && typeof ap[n] === "undefined") {
      if (dir > 0) {
        return null;
      } else {
        dir =- 1;
      }
    }

    if (ap[n] && bp[n] && ap[n] !== bp[n]) {
      return null;
    }
  }

  return dir;
};
