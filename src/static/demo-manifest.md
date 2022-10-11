---
schemaVersion: 1
id: compute-stateful-queue
title: Stateful queue (JavaScript)
description: |
  Using a third-party Redis API provider as a lightweight store, issue
  website visitors with a place in an orderly queue, and admit them to the
  website in a way that regulates load on your origin infrastructure.
repo: https://github.com/fastly/compute-starter-kit-javascript-queue
image:
  href: /demo-thumb.png
  alt: Holding page for a waiting room
expectedRootStatus: 401
views:
  endUser:
    mode: frame
    href: /index.html
    height: 550
  superUser:
    mode: frame
    href: /_queue
    height: 60
sessions: false
---

When a visitor makes a request for the first time, we generate a signed JWT containing their _position_ in the queue, which is determined by fetching the current queue _length_ from Redis (`INCR queue:length`). This signed JWT is sent back to the visitor as an HTTP cookie.

On a regular basis, the current queue _cursor_ is updated in Redis (`INCR queue:cursor`). This effectively lets a user in. To show a visitor how many others are in front of them in the queue, we subtract the current queue _cursor_ from the _position_ saved in their JWT.

On subsequent requests, when a JWT is supplied, we verify the signature and extract the _position_ from the JWT. If the current queue _cursor_ is higher than the user's signed _position_, they will be allowed in. This model is similar to the way many real-world "take a ticket" queueing systems work, with the ticket dispenser offering the next available number, and a screen on the wall indicating which customer is "now being served".

<!-- # Use it yourself

This demo is available as a [starter kit](https://developer.fastly.com/solutions/starters/compute-javascript-queue) and requires you to sign up to a third-party Redis provider, [Upstash](https://upstash.com), unless you'd like to set up your own, in which case you can swap out Upstash for your own HTTP API in the [`store.js`](https://github.com/fastly/compute-starter-kit-javascript-queue/blob/main/src/store.js)

1. If you haven't already, [sign up for a free Upstash account](https://console.upstash.com) and create a Redis service.
2. Initialize a Compute@Edge project using the starter kit.
   ```sh
   fastly compute init --from=https://github.com/fastly/compute-starter-kit-javascript-queue
   ```
3. Create the `upstash` backend, changing the default hostname to the one provided in the Upstash console.
4. Create the `protected_content` backend by accepting the default example host or setting your own.
5. Populate the `config` dictionary by following the prompts.
6. Run `fastly compute publish` to deploy your queue. -->
