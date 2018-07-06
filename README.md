# nginx-proxy-swarm-upstream

Companion container to nginx-proxy to generate upstream blocks for swarm services.

This container is a work in progress, and only the minimum needed to work with [Meteor Up](https://github.com/zodern/meteor-up) is done.

## Instructions

1. Start [nginx-proxy](https://github.com/jwilder/nginx-proxy). It should be connected to the same overlay network that your services are on. Please note: Using separate containers is currently not supported. A [modified nginx.tmpl](https://github.com/zodern/meteor-up/blob/mup-1.5/src/plugins/proxy/assets/nginx.tmpl) is required to support custom upstream blocks.
2. Run this image
```bash
docker run \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --volumes-from nginx-proxy \
  --network proxy-overlay-network \
  --name nginx-proxy-swarm-upstream \
  --env NGINX_PROXY_CONTAINER="name-of-nginx-proxy-container" \
  zodern/nginx-proxy-swarm-upstream
```

Only the `dnsrr` endpoint mode is currently supported.

Sticky sessions are enabled, and use `ip_hash`.

nginx-proxy only looks at containers on the same server when creating the nginx config. For it to know about the service, the service should either have a task on the same server as the nginx-proxy, or you can run a container on the server with the correct environment variables (`VIRTUAL_HOST`, `LETSENCRYPT_HOST`, etc.). The service or container should also have the environment variable `SWARM_SERVICE` set to the name of the service.

For example, if you have the service named `app` running on different servers than nginx-proxy, you could create this container on the servers with nginx-proxy:

```bash
docker run \
  --name proxy-configure-app \
  -d \
  --restart="always" \
  -e "SWARM_SERVICE=app" \
  -e "VIRTUAL_HOST=app.com" \
  -e "LETSENCRYPT_HOST=app.com" \
  -e "LETSENCRYPT_EMAIL=email@app.com" \
  busybox:1.28.4 tail -f /dev/null
```

## TODO:

- Support vip endpoint mode
- Allow sticky sessions to be customized
- Better error handling, and remove use of sync api's
