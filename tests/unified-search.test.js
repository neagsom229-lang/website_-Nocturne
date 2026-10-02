import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { createSearchUnifiedRouter } from '../backend/routes/searchUnified.js';

class MemorySearchDatabase {
  constructor() {
    this.cache = new Map();
    this.events = [];
  }

  prepare(sql) {
    const query = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    return {
      get: async (...params) => {
        if (query.includes('from search_cache')) {
          const [q, type, sort] = params;
          const key = `${q}:${type}:${sort ?? 'relevance'}`;
          const cached = this.cache.get(key);
          if (cached && cached.expires_at > Date.now()) {
            return { responseJson: cached.response_json };
          }
        }
        return undefined;
      },
      run: async (...params) => {
        if (query.includes('insert into search_cache')) {
          const [q, type, sort, responseJson] = params;
          const key = `${q}:${type}:${sort ?? 'relevance'}`;
          this.cache.set(key, {
            response_json: responseJson,
            expires_at: Date.now() + 3600000,
          });
          return { changes: 1 };
        }
        if (query.includes('insert into search_events')) {
          const [userId, q, type, resultCount] = params;
          this.events.push({ userId, query: q, type, resultCount, created_at: new Date() });
          return { changes: 1 };
        }
        return { changes: 0 };
      },
      all: async () => {
        return [];
      },
    };
  }
}

test('unified search API validation and endpoints', async () => {
  const db = new MemorySearchDatabase();
  const app = express();
  app.use(express.json());
  app.use('/api/search', createSearchUnifiedRouter({ database: db }));

  const server = app.listen(0);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api/search`;

  try {
    // Test empty query -> 400
    const resEmpty = await fetch(`${baseUrl}/unified`);
    assert.equal(resEmpty.status, 400);

    // Test invalid type -> 400
    const resInvalidType = await fetch(`${baseUrl}/unified?q=lofi&type=invalid`);
    assert.equal(resInvalidType.status, 400);

    // Test suggest with 1 char -> 400
    const resSuggestShort = await fetch(`${baseUrl}/suggest?q=l`);
    assert.equal(resSuggestShort.status, 400);
  } finally {
    server.close();
  }
});
