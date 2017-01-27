class FrozenQuery {

  constructor(query) {
    this._query = query;
  }

  append(part, _context) {

  }

  getTemplate() {
    return this._query.getTemplate();
  }

  toSql() {
    return this._query.toSql();
  }

  freeze() {
    return this;
  }
}

export default class Query {

  constructor(template = null, context = null) {
    this._templateParts = [];
    this._context = {};
    if (template) {
      this.append(template, context);
    }
  }

  append(part, context = null) {
    this._templateParts.push(part);
    if (context) {
      Object.assign(this._context, context);
    }
  }

  isEmpty() {
    return this._templateParts.length === 0;
  }

  getTemplate() {
    return this._templateParts.join(" ");
  }

  toSql() {
    let template = this.getTemplate();
    Object.keys(this._context).forEach(name => {
      template = template.replace(
        this._makeVariableRegex(name), this._context[name]);
    });
    return template;
  }

  _makeVariableRegex(name) {
    return new RegExp(`[$][{]${name}[}]`, "g");
  }

  freeze() {
    return new FrozenQuery(this);
  }
}
