docker rm -f nginx-swarm-upstream || true
docker build -t nginx-swarm-upstream .
docker run \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --network mup-proxy \
  --volumes-from mup-nginx-proxy \
  --name nginx-swarm-upstream \
  --env NGINX_PROXY_CONTAINER="mup-nginx-proxy" \
  nginx-swarm-upstream