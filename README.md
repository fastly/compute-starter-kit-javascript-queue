# Queuing on Compute@Edge starter kit

[![Deploy to Fastly](https://deploy.edgecompute.app/button)](https://deploy.edgecompute.app/deploy)

Park your users in a virtual queue to reduce the demand on your origins during peak times.

**For more details about other starter kits for Compute@Edge, see the [Fastly developer hub](https://developer.fastly.com/solutions/starters)**

## Features

* Park visitors in a queue to limit the amount of active users.
* Ship queue analytics to [log endpoints](https://developer.fastly.com/learning/integrations/logging).
* Forward Open Graph tags and other SEO-related metadata.
* Allow certain requests such as robots.txt, favicon, etc.

## Getting started

1. If you haven't already, [sign up for Upstash](https://www.npmjs.com/package/@upstash/redis) and create a Redis service.
2. Initialize a Compute@Edge project using this starter kit.
    ```sh
    fastly compute init --from=https://github.com/fastly/compute-starter-kit-javascript-queue
    ```
3. Create the `upstash` backend, changing the default hostname to the one provided in the Upstash console.
4. Create the `protected_content` backend by accepting the default example host or setting your own.
5. Populate the `config` dictionary by following the prompts.
6. Run `fastly compute publish` to deploy your queue.

## Understanding the code

This starter is fully-featured, and requires some dependencies on top of the [`@fastly/js-compute`](https://www.npmjs.com/package/@fastly/js-compute) npm package. The following is a list of the dependencies used:

* **[@upstash/redis](https://www.npmjs.com/package/@upstash/redis)** - a REST-based Redis client for storing queue state. You could easily swap this for your own storage backend.

The starter will require a backend to be configured to send requests to once visitors have made it through the queue. For demonstration, this is

The template uses webpack to bundle `index.js` and its imports into a single JS file, `bin/index.js`, which is then wrapped into a `.wasm` file, `bin/index.wasm` using the `js-compute-runtime` CLI tool bundled with the `@fastly/js-compute` npm package, and bundled into a `.tar.gz` file ready for deployment to Compute@Edge.

## Design

When a user makes a request for the first time, we generate a signed JWT containing their position in the queue, which is fetched from Upstash (INCR queue:length).

On a regular basis, the current queue cursor is updated in Upstash (INCR queue:cursor). This effectively lets a user in. To show a visitor how many others are in front of them in the queue, we subtract the current queue cursor from their position.

On subsequent requests, when a JWT is supplied, we verify the signature and extract the position from the JWT. If the current queue cursor in Upstash is higher than the user's signed position, they will be allowed in.

## Security issues

Please see our [SECURITY.md](SECURITY.md) for guidance on reporting security-related issues.
