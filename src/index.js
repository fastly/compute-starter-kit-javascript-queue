//! Compute@Edge queuing starter kit.

/// <reference types="@fastly/js-compute" />

import * as jws from "jws";
import * as base64 from "base-64";

import fetchConfig from "./config";

import { getQueueCookie, setQueueCookie } from "./cookies";

import {
  getStore,
  getQueueCursor,
  getQueueLength,
  incrementQueueCursor,
  incrementQueueLength,
  incrementAutoPeriod,
} from "./store";

import processView from "./views";

import adminView from "./views/admin.html";
import queueView from "./views/queue.html";

import demoManifest from "./static/demo-manifest.md";

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

  // For demo purposes, we serve this manifest. Feel free to delete this.
  if (url.pathname == "/.well-known/fastly/demo-manifest") {
    return new Response(demoManifest, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown",
      },
    });
  }

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

  // Configure the Redis interface.
  let redis = getStore(config);

  // Handle requests to admin endpoints.
  if (config.admin.path && url.pathname.startsWith(config.admin.path)) {
    return await handleAdminRequest(req, url.pathname, config, redis);
  }

  // Get the user's queue cookie.
  let cookie = getQueueCookie(req);

  // Decode the JWT signature to get the visitor's position in the queue.
  let payload =
    cookie && JSON.parse(jws.decode(cookie, "HS256", config.jwtSecret).payload);

  // If the queue cookie is set, verify that it is valid.
  let isValid =
    payload &&
    jws.verify(cookie, "HS256", config.jwtSecret) &&
    new Date(payload.expiry) > Date.now();

  // Fetch the current queue cursor.
  let queueCursor = await getQueueCursor(redis);

  // Initialise properties used to construct a response.
  let newToken = null;
  let visitorPosition = null;

  if (payload && isValid) {
    visitorPosition = payload.position;

    console.log(`validated token for queue position #${visitorPosition}`);
  } else {
    // Add a new visitor to the end of the queue.
    // If demo padding is set in the config, the queue will grow by that amount.
    visitorPosition = await incrementQueueLength(
      redis,
      config.queue.demoPadding ? config.queue.demoPadding : 1
    );

    console.log(`issued token for queue position #${visitorPosition}`);

    // Sign a JWT with the visitor's position.
    newToken = jws.sign({
      header: { alg: "HS256" },
      payload: {
        position: visitorPosition,
        expiry: new Date(Date.now() + config.queue.cookieExpiry * 1000),
      },
      secret: config.jwtSecret,
    });
  }

  console.log(
    `queue cursor: ${queueCursor}, visitor position: ${visitorPosition}`
  );

  let response = null;

  if (visitorPosition > queueCursor) {
    if (config.queue.automatic > 0) {
      let reqsThisPeriod = await incrementAutoPeriod(redis, config);

      if (reqsThisPeriod == 1) {
        let queueLength = await getQueueLength(redis);

        if (queueCursor < queueLength + config.queue.automaticQuantity) {
          console.log(
            `request triggered automatic increment (${config.queue.automaticQuantity})`
          );
          queueCursor = await incrementQueueCursor(
            redis,
            config.queue.automaticQuantity
          );

          if (visitorPosition < queueCursor) {
            response = await handleAuthorizedRequest(req);
          }
        }
      }
    }

    if (!response) {
      response = await handleUnauthorizedRequest(
        req,
        config,
        visitorPosition - queueCursor - 1
      );
    }
  } else {
    response = await handleAuthorizedRequest(req);
  }

  // Set a cookie on the response if needed and return it to the client.
  if (newToken) {
    setQueueCookie(response, newToken, config.queue.cookieExpiry);
  }
  return response;
}

// Handle an incoming request that has been authorized to access protected content.
async function handleAuthorizedRequest(req) {
  console.log("authorized! passing to backend");
  return await fetch(req, {
    backend: CONTENT_BACKEND,
    ttl: 21600,
  });
}

// Handle an incoming request that is not yet authorized to access protected content.
async function handleUnauthorizedRequest(req, config, visitorsAhead) {
  console.log("denied - serving queue page");

  return new Response(
    processView(queueView, {
      visitorsAhead: visitorsAhead.toLocaleString(),
      visitorsVerb: visitorsAhead == 1 ? "is" : "are",
      visitorsPlural: visitorsAhead == 1 ? "person" : "people",
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

// Handle an incoming request to an admin-related endpoint.
async function handleAdminRequest(req, path, config, redis) {
  if (
    config.admin.password &&
    req.headers.get("Authorization") !=
      `Basic ${base64.encode(`admin:${config.admin.password}`)}`
  ) {
    return new Response(null, {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Queue Admin"',
      },
    });
  }

  if (path == config.admin.path) {
    let visitorsWaiting =
      (await getQueueLength(redis)) - (await getQueueCursor(redis)) + 1;

    return new Response(
      processView(adminView, {
        adminBase: config.admin.path,
        visitorsWaiting,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  } else if (path == `${config.admin.path}/permit`) {
    await incrementQueueCursor(redis, 1);

    return new Response(null, {
      status: 302,
      headers: {
        Location: config.admin.path,
      },
    });
  }
}
