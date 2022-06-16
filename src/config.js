function fetchConfig() {
  let dict = new Dictionary("config");

  return {
    upstash: {
      url: dict.get("upstash_url"),
      token: dict.get("upstash_token"),
    },
    jwtSecret: dict.get("jwt_secret"),
    admin: {
      // the path for serving the admin interface and API
      //
      // set to null to disable the admin interface
      path: "/_queue",

      // the password for the admin interface, requested
      // when the admin path is accessed via HTTP Basic Auth
      // with the username `admin`.
      //
      // it is recommended that you change this in a production
      // deployment, or better, implement your own authentication
      // method, as this would allow anybody to skip the queue.
      //
      // set to null to disable HTTP Basic Auth (not recommended!)
      password: null,
    },
    queue: {
      // how often to refresh the queue page
      //
      // default 5 seconds
      refreshInterval: 5,

      // how long to remember a given visitor
      //
      // after this time, a visitor may lose their position in the queue
      // and have to start queuing again.
      //
      // default 24 hours
      cookieExpiry: 24 * 60 * 60,

      // how often to let visitors in automatically.
      // set to 0 to disable automatic queue advancement.
      //
      // only disable this if you have logic on the backend to call
      // the API to let in visitors. if you don't let enough visitors
      // in, they may queue forever.
      //
      // you may still call the admin API (if enabled) to let in more
      // visitors than configured here.
      //
      // default 15 seconds
      automatic: 15,

      // how many visitors should be let in at a time?
      //
      // default 5
      automaticQuantity: 5,

      // for demonstration purposes only, how many visitors should be
      // added to the queue ahead of a new visitor
      //
      // default 15, set to 1 for normal behaviour
      demoPadding: 15,
    },
  };
}

export default fetchConfig;
