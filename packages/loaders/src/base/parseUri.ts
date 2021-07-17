/**
 * function from npm package `parseUri`, converted to TS to avoid leftpad incident
 * @param {string} str
 * @param [opts] options
 * @param {boolean} [opts.strictMode] type of parser
 */
export function parseUri(str: string, opts: { strictMode?: boolean }): any
{
    opts = opts || {};

    const o = {
        // eslint-disable-next-line max-len
        key: ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'],
        q: {
            name: 'queryKey',
            parser: /(?:^|&)([^&=]*)=?([^&]*)/g
        },
        parser: {
            // eslint-disable-next-line max-len
            strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
            // eslint-disable-next-line max-len
            loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
        }
    };

    const m = o.parser[opts.strictMode ? 'strict' : 'loose'].exec(str);
    const uri: any = {};
    let i = 14;

    while (i--) uri[o.key[i]] = m[i] || '';

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, (_t0: any, t1: any, t2: any) =>
    {
        if (t1) uri[o.q.name][t1] = t2;
    });

    return uri;
}
