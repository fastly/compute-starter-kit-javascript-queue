//! Compute@Edge queuing starter kit.

/// <reference types="@fastly/js-compute" />

import { includeBytes } from "fastly:experimental";
import * as jws from "jws";

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

import log from "./logging";

import processView from "./views";

const textDecoder = new TextDecoder();

const adminView = textDecoder.decode(includeBytes('src/views/admin.html'));
const queueView = textDecoder.decode(includeBytes('src/views/queue.html'));

// For demo purposes
const demoManifest = textDecoder.decode(includeBytes('src/static/demo-manifest.md'));
const DEMO_THUMBNAIL = includeBytes('src/static/demo-thumb.png');

// The name of the backend serving the content that is being protected by the queue.
const CONTENT_BACKEND = "protected_content";

// An array of paths that will be served from the origin regardless of the visitor's queue state.
const ALLOWED_PATHS = [
  "/robots.txt",
  "/favicon.ico",
  "/assets/background.jpg",
  "/assets/logo.svg",
];

// The name of the log endpoint receiving request logs.
const LOG_ENDPOINT = "queue_logs";

// The entry point for your application.
addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

// Handle an incoming request.
async function handleRequest(event) {
  // Get the client request and parse the URL.
  const { request, client } = event;
  const url = new URL(request.url);

  // Metadata foe developer.fastly.com.
  // Feel free to delete this.
  if (url.pathname == "/.well-known/fastly/demo-manifest") {
    return new Response(demoManifest, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown",
      },
    });
  } else if (url.pathname == "/demo-thumb.png") {
    return new Response(DEMO_THUMBNAIL, {
      status: 200,
      headers: { 'content-type': 'image/png' }
    });
  }

  // Allow requests to assets that are not protected by the queue.
  if (ALLOWED_PATHS.includes(url.pathname)) {
    let resp = await handleAuthorizedRequest(request);

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
    return await handleAdminRequest(request, url.pathname, config, redis);
  }

  // Get the user's queue cookie.
  let cookie = getQueueCookie(request);

  let payload = null;
  let isValid = false;

  try {
    // Decode the JWT signature to get the visitor's position in the queue.
    payload =
      cookie &&
      JSON.parse(jws.decode(cookie, "HS256", config.jwtSecret).payload);

    // If the queue cookie is set, verify that it is valid.
    isValid =
      payload &&
      jws.verify(cookie, "HS256", config.jwtSecret) &&
      new Date(payload.expiry) > Date.now();
  } catch (e) {
    console.error(`Error while validating cookie: ${e}`);
  }

  // Fetch the current queue cursor.
  let queueCursor = await getQueueCursor(redis);

  // Initialise properties used to construct a response.
  let newToken = null;
  let visitorPosition = null;

  if (payload && isValid) {
    visitorPosition = payload.position;
  } else {
    // Add a new visitor to the end of the queue.
    // If demo padding is set in the config, the queue will grow by that amount.
    visitorPosition = await incrementQueueLength(
      redis,
      config.queue.demoPadding ? config.queue.demoPadding : 1
    );

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

  let permitted = queueCursor >= visitorPosition;
  let response = null;

  if (!permitted) {
    if (config.queue.automatic > 0) {
      let reqsThisPeriod = await incrementAutoPeriod(redis, config);

      if (reqsThisPeriod == 1) {
        let queueLength = await getQueueLength(redis);

        if (queueCursor < queueLength + config.queue.automaticQuantity) {
          queueCursor = await incrementQueueCursor(
            redis,
            config.queue.automaticQuantity
          );

          if (visitorPosition < queueCursor) {
            permitted = true;
          }
        }
      }
    }
  }

  if (!permitted) {
    response = await handleUnauthorizedRequest(
      request,
      config,
      visitorPosition - queueCursor - 1
    );
  } else {
    response = await handleAuthorizedRequest(request);
  }

  // Set a cookie on the response if needed and return it to the client.
  if (newToken) {
    response = setQueueCookie(response, newToken, config.queue.cookieExpiry);
  }

  // Log the request and response.
  log(
    fastly.getLogger(LOG_ENDPOINT),
    request,
    client,
    permitted,
    response.status,
    {
      queueCursor,
      visitorPosition,
    }
  );

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
      `Basic ${btoa(`admin:${config.admin.password}`)}`
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
      (await getQueueLength(redis)) - (await getQueueCursor(redis));

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
    let amt = parseInt(
      new URL("http://127.0.0.1/?" + (await req.text())).searchParams.get("amt")
    );
    await incrementQueueCursor(redis, amt || 1);

    return returnToAdmin(config);
  } else if (path == `${config.admin.path}/clear_self`) {
    return setQueueCookie(returnToAdmin(config), null, 60);
  }
}

function returnToAdmin(config) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: config.admin.path,
    },
  });
}
