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

export function inspectContainer (containerId) {
  return docker.getContainer(containerId).inspect();
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

export async function serviceExists (name) {
  const result = await docker.listServices({ filters: JSON.stringify({ name: [ name ]}) });

  return result.length > 0;
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
    super();
    this.setupListener();
  }

  setupListener () {
    dockerEventListener(event => {
      if (event.Type === 'container') {
        this.handleContainerEvent(event);
      } else if (event.Type === 'service') {
        this.handleServiceEvent(event);
      }
    });
  }

  handleContainerEvent (event) {
    switch (event.Action) {
      case 'kill':
        this.emit('containerKilled', event.id, event.Actor.Attributes.name);
        break;
      case 'start':
        this.emit('containerStarted', event.id);

      // no default
    }
  }

  handleServiceEvent (event) {
    switch (event.Action) {
      case 'create':
        this.emit('serviceCreated', event.Actor.ID, event.Actor.Attributes.name);

      // no default
    }
  }
}
