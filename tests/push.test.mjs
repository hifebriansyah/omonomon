import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { vapidHeader } from "../worker/api.js";

globalThis.crypto ??= webcrypto; // older Node versions have no global crypto

test("the VAPID header is a valid ES256 token for the push service's origin, with the matching public key", async () => {
  const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  const header = await vapidHeader({ VAPID_PRIVATE_JWK: JSON.stringify(jwk), VAPID_SUBJECT: "mailto:a@b.c" }, "https://push.example.com/send/abc");
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header);
  assert.ok(m, header);
  const claims = JSON.parse(Buffer.from(m[2], "base64url").toString());
  assert.equal(claims.aud, "https://push.example.com");
  assert.equal(claims.sub, "mailto:a@b.c");
  assert.ok(claims.exp > Date.now() / 1000);
  const raw = Buffer.from(await crypto.subtle.exportKey("raw", publicKey)).toString("base64url");
  assert.equal(m[4], raw);
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, Buffer.from(m[3], "base64url"), new TextEncoder().encode(`${m[1]}.${m[2]}`));
  assert.equal(ok, true);
});
