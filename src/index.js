//! Compute@Edge queuing starter kit.

/// <reference types="@fastly/js-compute" />

import * as jws from "jws";

import fetchConfig from "./config";
import { getQueueCookie, setQueueCookie } from "./cookies";
import { addToQueue, getQueueCursor, getRedis } from "./store";
import processView from "./views";

import queueView from "./views/queue.html";

// The name of the backend serving the content that is being protected by the queue.
const CONTENT_BACKEND = "protected_content";

// An array of paths that will be served from the origin regardless of the visitor's queue state.
const ALLOWED_PATHS = [
  "/robots.txt",
  "/favicon.ico",
  "/assets/background.jpg",
  "/assets/logo.svg",
];

// The entry point for your application.
addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

// Handle an incoming request.
async function handleRequest(event) {
  // Get the client request and parse the URL.
  let req = event.request;
  let url = new URL(req.url);

  console.log(`received request ${req.method} ${url.pathname}`);

  // Allow requests to assets that are not protected by the queue.
  if (ALLOWED_PATHS.includes(url.pathname)) {
    let resp = await handleAuthorizedRequest(req);

    // Override the Cache-Control header on assets
    if (!resp.headers.has("Cache-Control") && resp.status == 200) {
      resp.headers.set("Cache-Control", "public, max-age=21600");
    }

    return resp;
  }

  // Get the queue configuration.
  let config = fetchConfig();

  let cookie = getQueueCookie(req);
  let isValid = cookie && jws.verify(cookie, "HS256", config.jwtSecret);

  let redis = getRedis(config);

  let queueCursor = await getQueueCursor(redis);

  let newToken = null;
  let visitorPosition = null;

  if (isValid) {
    let payload = JSON.parse(
      jws.decode(cookie, "HS256", config.jwtSecret).payload
    );

    visitorPosition = payload.position;

    console.log(`validated token for queue position #${visitorPosition}`);
  } else {
    visitorPosition = await addToQueue(redis);

    console.log(`issued token for queue position #${visitorPosition}`);

    newToken = jws.sign({
      header: { alg: "HS256" },
      payload: {
        position: visitorPosition,
      },
      secret: config.jwtSecret,
    });
  }

  console.log(
    `queue cursor: ${queueCursor}, visitor position: ${visitorPosition}`
  );

  let responseHandler =
    visitorPosition >= queueCursor
      ? handleUnauthorizedRequest(req, config, visitorPosition - queueCursor)
      : handleAuthorizedRequest(req);

  let response = await responseHandler;
  if (newToken) {
    setQueueCookie(response, newToken);
  }
  return response;
}

// Handle an incoming request that has been authorized to access protected content.
async function handleAuthorizedRequest(req) {
  return await fetch(req, {
    backend: CONTENT_BACKEND,
    ttl: 21600,
  });
}

// Handle an incoming request that is not yet authorized to access protected content.
async function handleUnauthorizedRequest(req, config, visitorsAhead) {
  return new Response(
    processView(queueView, {
      visitorsAhead: visitorsAhead.toLocaleString(),
      refreshInterval: config.queue.refreshInterval,
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
}
