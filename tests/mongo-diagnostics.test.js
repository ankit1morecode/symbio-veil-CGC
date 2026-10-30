import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseMongoError } from '../server/mongo-diagnostics.js';
import dns from 'node:dns';
import { MongoClient } from 'mongodb';

function assertDiagnosis(error, expected) {
  const result = diagnoseMongoError(error);
  assert.equal(result.code, expected);
  assert.equal(typeof result.message, 'string');
  assert.ok(result.message.length > 0);
  return result;
}

test('recognizes authentication and permission failures from driver codes', () => {
  assertDiagnosis({ code: 18 }, 'MONGODB_AUTH');
  assertDiagnosis({ codeName: 'AuthenticationFailed' }, 'MONGODB_AUTH');
  assertDiagnosis({ name: 'MongoMissingCredentialsError' }, 'MONGODB_AUTH');
  assertDiagnosis({ code: 13 }, 'MONGODB_PERMISSION');
  assertDiagnosis({ codeName: 'Unauthorized' }, 'MONGODB_PERMISSION');
});

test('classifies malformed connection configuration by documented error name', () => {
  for (const name of ['MongoParseError', 'MongoInvalidArgumentError', 'URIError']) {
    assertDiagnosis({ name }, 'MONGODB_URI');
  }
});

test('classifies DNS, TLS, and network failures using known error codes', () => {
  for (const code of ['ENOTFOUND', 'EAI_AGAIN', 'ENODATA', 'EBADNAME', 'ENONAME', 'EFORMERR', 'ESERVFAIL', 'EREFUSED', 'EBADRESP', 'ETIMEOUT']) {
    assertDiagnosis({ code }, 'MONGODB_DNS');
  }
  for (const code of ['CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE']) {
    assertDiagnosis({ code }, 'MONGODB_TLS');
  }
  for (const code of ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH']) {
    assertDiagnosis({ code }, 'MONGODB_NETWORK');
  }
  assertDiagnosis({ name: 'MongoNetworkTimeoutError' }, 'MONGODB_NETWORK');
  assertDiagnosis({ name: 'MongoNetworkError' }, 'MONGODB_NETWORK');
  assertDiagnosis({ name: 'MongoAPIError' }, 'MONGODB_CONFIG_OR_DNS');
});

test('distinguishes a generic selection failure from specific nested driver errors', () => {
  for (const name of ['MongoServerSelectionError', 'MongooseServerSelectionError']) {
    assertDiagnosis({ name }, 'MONGODB_SELECTION');
    const nested = {
      name,
      reason: { servers: new Map([['example', { error: { cause: { code: 18 } } }]]) },
    };
    assertDiagnosis(nested, 'MONGODB_AUTH');
  }
  assertDiagnosis({ cause: { cause: { code: 'ENOTFOUND' } } }, 'MONGODB_DNS');
  assertDiagnosis({ reason: { servers: new Map([['server', { error: { code: 'ECONNREFUSED' } }]]) } }, 'MONGODB_NETWORK');
});

test('unknown or cyclic errors remain safe and do not echo untrusted fields', () => {
  const secret = 'mongodb://private-user:do-not-print@secret-host.invalid/private-db';
  const input = { name: secret, code: secret, codeName: secret, message: secret, stack: secret };
  input.cause = input;
  input.reason = { servers: new Map([['secret-host.invalid', { error: input }]]) };
  const result = assertDiagnosis(input, 'MONGODB_UNKNOWN');
  assert.doesNotMatch(JSON.stringify(result), /private-user|do-not-print|secret-host|private-db/);
  const recognized = assertDiagnosis({ code: 18, message: secret, stack: secret }, 'MONGODB_AUTH');
  assert.doesNotMatch(JSON.stringify(recognized), /private-user|do-not-print|secret-host|private-db/);
  assertDiagnosis(null, 'MONGODB_UNKNOWN');
  assert.match(assertDiagnosis({ name: 'TypeError', message: secret }, 'MONGODB_UNKNOWN').message, /Safe error type: TypeError/);
  assert.match(assertDiagnosis({ name: secret }, 'MONGODB_UNKNOWN').message, /Safe error type: unclassified/);
});

test('classifies a real driver SRV lookup failure without exposing connection details', async () => {
  const originalSrv = dns.promises.resolveSrv;
  const originalTxt = dns.promises.resolveTxt;
  dns.promises.resolveSrv = async () => {
    const error = new Error('synthetic host and password must never be logged');
    error.code = 'EBADNAME';
    throw error;
  };
  dns.promises.resolveTxt = async () => [];
  const client = new MongoClient('mongodb+srv://fake-user:fake-password@cluster.example.test/veil');
  try {
    await assert.rejects(client.connect(), error => {
      const result = assertDiagnosis(error, 'MONGODB_DNS');
      assert.doesNotMatch(JSON.stringify(result), /fake-user|fake-password|cluster\.example|synthetic host/);
      return true;
    });
  } finally {
    await client.close();
    dns.promises.resolveSrv = originalSrv;
    dns.promises.resolveTxt = originalTxt;
  }
});
