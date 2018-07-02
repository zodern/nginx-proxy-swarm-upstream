/* eslint-disable no-console, no-warning-comments */
import Services from './services';
import { docker, dockerEventListener, filterContainers } from './get-endpoints';
import { generateConfig, reloadNginx } from './nginx';

const services = new Services();

services.on('endpointsChanged', service => {
  console.log('endpoint changed', service.service, service.endpoints);
  generateConfig(service.hosts, service.endpoints);

  // TODO: debounce
  reloadNginx();
});

// Find already existent config containers
docker.
  listContainers().
  then(filterContainers).
  then(result => {
    console.log('Found services', result.map(service => service.service));
    services.addServices(result);
  });

dockerEventListener(() => {
  // TODO: handle events
  // console.log('received event', event.Type, event.Action);
});
