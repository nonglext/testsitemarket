import {WebSocketServer, WebSocket} from 'ws';
import jwt from 'jsonwebtoken';
import {db} from './db.js';

let sockets;

export function setupRealtime(server) {
  sockets = new WebSocketServer({noServer:true});
  server.on('upgrade', async (request, socket, head) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname !== '/ws') return socket.destroy();
      if (process.env.PUBLIC_ORIGIN) {
        const allowedOrigin = new URL(process.env.PUBLIC_ORIGIN).origin;
        if (request.headers.origin !== allowedOrigin) return socket.destroy();
      }
      const cookies = Object.fromEntries((request.headers.cookie || '').split(';').map(part => {
        const index = part.indexOf('=');
        return index < 0 ? ['', ''] : [part.slice(0,index).trim(), part.slice(index+1)];
      }));
      const claims = jwt.verify(cookies.access, process.env.JWT_SECRET, {algorithms:['HS256']});
      const result = await db.query("SELECT s.user_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active'", [claims.sid]);
      if (!result.rowCount || socket.destroyed) return socket.destroy();
      sockets.handleUpgrade(request, socket, head, ws => {
        ws.userId = result.rows[0].user_id;
        ws.sessionId = String(claims.sid);
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        ws.on('error', () => {});
        const expires = setTimeout(() => ws.close(1008, 'Session expired'), Math.max(0, claims.exp * 1000 - Date.now()));
        ws.on('close', () => clearTimeout(expires));
        ws.send(JSON.stringify({type:'ready'}));
      });
    } catch {
      socket.destroy();
    }
  });
  const heartbeat = setInterval(() => {
    for (const ws of sockets.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  server.on('close', () => clearInterval(heartbeat));
}

export function closeSessionSockets(sessionId) {
  if (!sockets) return;
  for (const ws of sockets.clients) {
    if (ws.sessionId === String(sessionId)) ws.close(1008, 'Session revoked');
  }
}

export async function notifyOrder(orderId, type) {
  if (!sockets) return;
  try {
    const result = await db.query('SELECT buyer_id,seller_id FROM demo_orders WHERE id=$1', [orderId]);
    if (!result.rowCount) return;
    const participants = new Set(Object.values(result.rows[0]));
    const message = JSON.stringify({type,orderId:String(orderId)});
    for (const ws of sockets.clients) {
      if (ws.readyState === WebSocket.OPEN && participants.has(ws.userId)) ws.send(message);
    }
  } catch (error) {
    console.error('Realtime notification failed:', error.message);
  }
}
