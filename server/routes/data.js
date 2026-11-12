import { Router } from 'express';
import { CONFIG } from '../config.js';
import { notFound, validationError } from '../core/errors.js';
import {
  parseAlertQuery,
  parseArcQuery,
  parseEnum,
  parseStringParam,
  parseTradeQuery,
  parseWindow,
} from '../core/validate.js';
import { ASSETS } from '../core/seed.js';

const STREAM_EVENTS = new Set(['trade', 'alert', 'kpi', 'market', 'status']);

function send(res, data) {
  return res.json({ data, serverTime: Date.now() });
}

export function createDataRouter(provider, authenticate) {
  const router = Router();
  router.use(authenticate);

  router.get('/meta', (_req, res) => send(res, provider.getMeta()));

  router.get('/nodes', (_req, res) => send(res, { nodes: provider.getNodes() }));

  router.get('/trades', (req, res) => {
    const query = parseTradeQuery(req.query);
    const result = provider.getTrades(query);
    const { serverTime: _ignored, ...page } = result;
    send(res, page);
  });

  router.get('/trades/:id', (req, res) => {
    const trade = provider.getTradeById(req.params.id);
    if (!trade) throw notFound('交易不存在');
    send(res, { trade });
  });

  router.get('/alerts', (req, res) => {
    const query = parseAlertQuery(req.query);
    send(res, provider.getAlerts(query));
  });

  router.get('/kpis', (req, res) => {
    const windowKey = parseWindow(req.query.window);
    send(res, provider.getKpis(windowKey));
  });

  router.get('/timeseries', (req, res) => {
    const range = parseEnum(req.query.range, CONFIG.ranges, 'range', '24h');
    send(res, provider.getTimeseries(range));
  });

  router.get('/aggregations/assets', (req, res) => {
    const windowKey = parseWindow(req.query.window);
    send(res, provider.getAssetShares(windowKey));
  });

  router.get('/aggregations/regions', (req, res) => {
    const windowKey = parseWindow(req.query.window);
    const limitRaw = req.query.limit;
    const limit = limitRaw == null ? 8 : Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw validationError('limit 必须是 1~20 之间的整数', { field: 'limit', value: limitRaw });
    }
    send(res, provider.getRegionRanking(windowKey, limit));
  });

  router.get('/aggregations/depth', (req, res) => {
    const asset = parseStringParam(req.query.asset, 'asset', { max: 16 }) ?? 'BTC/USD';
    if (!ASSETS.some((item) => item.asset === asset)) {
      throw notFound(`资产 ${asset} 不在演示资产表内`);
    }
    const depth = provider.getDepth(asset);
    if (!depth) throw notFound(`无法生成 ${asset} 的盘口`);
    send(res, depth);
  });

  router.get('/aggregations/health', (_req, res) => send(res, provider.getHealth()));

  router.get('/aggregations/arcs', (req, res) => {
    const query = parseArcQuery(req.query);
    send(res, provider.getArcs(query));
  });

  router.get('/markets', (_req, res) => send(res, provider.getMarkets()));

  router.get('/stream', (req, res) => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let eventId = 0;
    const writeEvent = (event, data) => {
      eventId += 1;
      res.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    res.write('retry: 5000\n\n');
    provider.store.addClient();
    writeEvent('hello', {
      meta: provider.getMeta(),
      status: provider.store.streamStatus(),
    });

    const unsubscribe = provider.subscribe((type, data) => {
      if (!STREAM_EVENTS.has(type)) return;
      writeEvent(type, data);
    });

    const heartbeat = setInterval(() => {
      writeEvent('heartbeat', { ts: Date.now() });
    }, CONFIG.heartbeatMs);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      unsubscribe();
      provider.store.removeClient();
    };
    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('error', cleanup);
  });

  return router;
}
