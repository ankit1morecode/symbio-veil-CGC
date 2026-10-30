// Never include driver messages, server addresses, or URI values in logs.
const hints = {
  MONGODB_AUTH: 'Database authentication failed. Check the Atlas database username and password, including URL encoding of special characters.',
  MONGODB_PERMISSION: 'The database user is not authorized. Check its Atlas database permissions.',
  MONGODB_URI: 'The connection string is invalid. Copy the Node.js driver URI from Atlas and replace its placeholders.',
  MONGODB_DNS: 'The database hostname could not be resolved. Check the Atlas cluster address and that the cluster is active.',
  MONGODB_TLS: 'A TLS certificate check failed. Check the database endpoint and certificate configuration.',
  MONGODB_NETWORK: 'The database could not be reached. Check the Atlas IP access list, network access, and cluster status.',
  MONGODB_SELECTION: 'No database server was selected in time. Check Atlas network access, cluster status, DNS, and credentials.',
  MONGODB_UNKNOWN: 'Check the Atlas connection string, database user, cluster status, and network access.',
};

export function diagnoseMongoError(error) {
  const queue = [error], visited = new Set(), found = new Set();
  while (queue.length && visited.size < 100) {
    const item = queue.shift();
    if (!item || typeof item !== 'object' || visited.has(item)) continue;
    visited.add(item);
    const { name, code, codeName } = item;
    if (code === 18 || codeName === 'AuthenticationFailed') found.add('MONGODB_AUTH');
    if (code === 13 || codeName === 'Unauthorized') found.add('MONGODB_PERMISSION');
    if (['MongoParseError', 'MongoInvalidArgumentError'].includes(name) || code === 'ERR_INVALID_URL') found.add('MONGODB_URI');
    if (['ENOTFOUND', 'EAI_AGAIN', 'ENODATA'].includes(code)) found.add('MONGODB_DNS');
    if (['CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_UNTRUSTED'].includes(code)) found.add('MONGODB_TLS');
    if (['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code) || name === 'MongoNetworkTimeoutError') found.add('MONGODB_NETWORK');
    if (['MongoServerSelectionError', 'MongooseServerSelectionError'].includes(name)) found.add('MONGODB_SELECTION');
    queue.push(item.cause, item.reason, item.error);
    if (item.servers instanceof Map) for (const server of item.servers.values()) queue.push(server);
  }
  const code = ['MONGODB_AUTH', 'MONGODB_PERMISSION', 'MONGODB_URI', 'MONGODB_DNS', 'MONGODB_TLS', 'MONGODB_NETWORK', 'MONGODB_SELECTION'].find(key => found.has(key)) || 'MONGODB_UNKNOWN';
  return { code, message: hints[code] };
}
