/* eslint-disable no-sync, no-process-env */
import { docker } from './docker';
import { promises as fs } from 'fs';
import path from 'path';

const UPSTREAM_DIR = '/etc/nginx/vhost.d';
const ENDPOINT_PREFIX = '# endpoints=';
const NGINX_PROXY_CONTAINER = process.env.NGINX_PROXY_CONTAINER;

export const CONFIG_IDENTIFIER = '# GENERATED BY NGINX_PROXY_SWARM_UPSTREAM';

export function generateConfig (hosts, endpoints, port) {
  const servers = endpoints.map(endpoint => `server ${endpoint}:${port};`).join('\n');
  const config = `
  ${CONFIG_IDENTIFIER}
  ${ENDPOINT_PREFIX}${JSON.stringify(endpoints)}
  ${servers}
  ip_hash;
  `;

  const promises = hosts.map(host => {
    const filePath = `${UPSTREAM_DIR}/${host}_upstream`;

    return fs.writeFile(filePath, config);
  });

  return Promise.all(promises);
}

export function removeConfigs (hosts) {
  const promises = hosts.map(host => {
    const filePath = `${UPSTREAM_DIR}/${host}_upstream`;

    return fs.unlink(filePath);
  });

  return Promise.all(promises);
}

export function reloadNginx () {
  console.log('Reloading nginx');

  docker.getContainer(NGINX_PROXY_CONTAINER).exec({
    Cmd: [ 'sh', '-c', '/app/docker-entrypoint.sh /usr/local/bin/docker-gen /app/nginx.tmpl /etc/nginx/conf.d/default.conf; /usr/sbin/nginx -s reload' ],
    AttachStdin: false,
    AttachStdout: true
  }, (err, exec) => {
    if (err) {
      console.log(err);

      return;
    }

    exec.start({
      hijack: true,
      stdin: false
    }, (_err, stream) => {
      if (_err) {
        console.log(_err);
      }

      docker.modem.demuxStream(stream, process.stdout, process.stderr);
    });
  });
}

async function findGeneratedConfigs () {
  const dirents = await fs.readdir(UPSTREAM_DIR, { withFileTypes: true });
  const upstreamConfigs = dirents.filter(
    item => item.isFile() && item.name.endsWith('_upstream')
  );

  const contents = await Promise.all(
    upstreamConfigs.map(async config => ({
      name: config.name,
      content: (await fs.readFile(path.resolve(UPSTREAM_DIR, config.name))).toString().trim(),
      host: config.name.split('_upstream').slice(0, -1).
        join('')
    }))
  );

  return contents.filter(({ content }) => content.startsWith(CONFIG_IDENTIFIER));
}

export async function getKnownServices () {
  const generatedConfigs = await findGeneratedConfigs();

  return generatedConfigs.map(config => {
    const secondLine = config.content.split('\n')[1].trim();
    let endpoints = [];

    if (secondLine.startsWith(ENDPOINT_PREFIX)) {
      const json = secondLine.slice(ENDPOINT_PREFIX.length);

      try {
        endpoints = JSON.parse(json);
      } catch (error) {
        console.log(error);
      }
    }

    return {
      name: config.name,
      host: config.host,
      endpoints
    };
  });
}
