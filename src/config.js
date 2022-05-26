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
      path: '/_queue',

      // the password for the admin interface, requested
      // when the admin path is accessed via HTTP Basic Auth
      // with the username `admin`.
      //
      // it is recommended that you change this in a production
      // deployment, or better, implement your own authentication
      // method, as this would allow anybody to skip the queue.
      //
      // set to null to disable HTTP Basic Auth (not recommended!)
      password: 'fastly'
    },
    queue: {
      // how often to refresh the queue page
      //
      // default 10 seconds
      refreshInterval: 10,

      // how long to remember a visitor's position in the queue
      //
      // after this time, a visitor may lose their position in the queue
      // and have to start queuing again.
      //
      // default 48 hours
      maxQueueDuration: 48 * 60 * 60,

      // how long to let a visitor access the protected
      // content after they have been let in
      //
      // default 48 hours
      accessDuration: 48 * 60 * 60,

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
      // default 30 seconds
      automatic: 30,

      // how many visitors should be let in at a time?
      //
      // default 1000
      automaticQuantity: 1000
    }
  };
}

export default fetchConfig;
