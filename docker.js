import Docker from 'dockerode';
import { EventEmitter } from 'events';

export const docker = new Docker();

export function getEnvValue (env, variable) {
  const start = `${variable}=`;

  for (let i = 0; i < env.length; i++) {
    if (env[i].startsWith(start)) {
      return env[i].split('=').slice(1).
        join('=');
    }
  }

  return null;
}

export function filterContainers (containers) {
  const promises = containers.map(container => docker.getContainer(container.Id).inspect());

  return Promise.all(promises).then(result => {
    const serviceContainers = [];

    result.forEach(container => {
      const env = container.Config.Env;
      const virtualHosts = getEnvValue(env, 'VIRTUAL_HOST');
      const swarmService = getEnvValue(env, 'SWARM_SERVICE');
      const virtualPort = getEnvValue(env, 'VIRTUAL_PORT');

      if (virtualHosts && swarmService) {
        serviceContainers.push({
          container: container.Id,
          service: swarmService,
          hosts: virtualHosts.split(','),
          port: virtualPort || 80
        });
      }
    });

    return serviceContainers;
  });
}

export function dockerEventListener (cb) {
  docker.getEvents().then(stream => {
    stream.setEncoding('utf8');
    stream.on('data', json => {
      const data = JSON.parse(json);

      // console.dir(data, { depth: 6 });
      cb(data);
    });
  });
}

export class ContainerWatcher extends EventEmitter {
  constructor () {
    this.setupListener();
  }

  setupListener () {
    dockerEventListener(() => {
      this.handleEvent();
    });
  }

  handleEvent (event) {
    if (event.Type !== 'container') {
      return;
    }

    switch (event.Action) {
      case 'kill':
        this.emit('killed', event.id);
        break;
      case 'start':
        this.emit('start', event.id);

      // no default
    }
  }
}
