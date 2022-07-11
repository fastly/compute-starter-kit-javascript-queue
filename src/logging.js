export default function log(
  logger,
  req,
  client,
  permitted,
  responseStatus,
  queueData
) {
  logger.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      clientAddress: client.address,
      requestUrl: req.url.toString(),
      requestMethod: req.method,
      requestReferer: req.headers.get("Referer"),
      requestUserAgent: req.headers.get("User-Agent"),
      fastlyRegion: fastly.env.get("FASTLY_REGION"),
      fastlyServiceId: fastly.env.get("FASTLY_SERVICE_ID"),
      fastlyServiceVersion: fastly.env.get("FASTLY_SERVICE_VERSION"),
      fastlyHostname: fastly.env.get("FASTLY_HOSTNAME"),
      fastlyTraceId: fastly.env.get("FASTLY_TRACE_ID"),
      ...tryGeo(client),
      responseStatus,
      permitted,
      ...queueData,
    })
  );
}

// Geolocation is not supported by the local testing server,
// so we just return an empty object if it fails.
function tryGeo(client) {
  try {
    return {
      clientGeoCountry: client.geo.country_code,
      clientGeoCity: client.geo.city,
    };
  } catch (e) {
    return {};
  }
}
