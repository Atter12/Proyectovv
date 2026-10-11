import assert from "node:assert/strict";
import test from "node:test";
import {
  createRateLimiter,
  isTikTokRateLimited,
  rateLimitBackoffMs,
} from "./rate-limit.ts";

test("reconoce los códigos de límite de TikTok", () => {
  assert.equal(isTikTokRateLimited(40100, "Requests made too frequently"), true);
  assert.equal(isTikTokRateLimited(40133, ""), true);
  assert.equal(isTikTokRateLimited(0, "OK"), false);
  assert.equal(isTikTokRateLimited(40002, "Invalid param"), false);
});

test("reconoce el límite por el mensaje aunque el código sea otro", () => {
  assert.equal(isTikTokRateLimited(undefined, "OVER_QPS_LIMIT"), true);
  assert.equal(isTikTokRateLimited(50000, "App qps limit reached"), true);
});

test("solo reintenta dos veces y luego se rinde", () => {
  assert.equal(rateLimitBackoffMs(0), 1500);
  assert.equal(rateLimitBackoffMs(1), 4000);
  assert.equal(rateLimitBackoffMs(2), null);
});

test("espacia las consultas a 1000/qps ms aunque salgan en paralelo", async () => {
  let clock = 1000;
  const waits: number[] = [];
  const limiter = createRateLimiter({
    qps: 4,
    now: () => clock,
    sleep: async (ms) => {
      waits.push(ms);
    },
  });
  await Promise.all([limiter.acquire(), limiter.acquire(), limiter.acquire()]);
  assert.deepEqual(waits, [250, 500]);

  // Si pasa el tiempo, la siguiente sale sin esperar.
  clock += 5000;
  waits.length = 0;
  await limiter.acquire();
  assert.deepEqual(waits, []);
});

test("un qps inválido usa 5 por segundo", async () => {
  const waits: number[] = [];
  const limiter = createRateLimiter({ qps: 0, now: () => 0, sleep: async (ms) => void waits.push(ms) });
  await limiter.acquire();
  await limiter.acquire();
  assert.deepEqual(waits, [200]);
});
