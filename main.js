/* eslint-disable no-console, no-warning-comments */
import Services from './services';
import { docker, dockerEventListener, filterContainers } from './get-endpoints';
import { generateConfig, reloadNginx, removeConfig } from './nginx';

const services = new Services();

services.on('endpointsChanged', service => {
  console.log('endpoint changed:', service.service, service.endpoints);
  generateConfig(service.hosts, service.endpoints);

  // TODO: debounce
  reloadNginx();
});

services.on('serviceRemoved', service => {
  console.log('service removed:', service.service);
  removeConfig(service.hosts);

  reloadNginx();
});

function checkContainers (containers) {
  filterContainers(containers).then(result => {
    if (result.length > 0) {
      console.log('Found services:', result.map(service => service.service));
      services.addServices(result);
    }
  });
}

// Find already existent config containers
docker.
  listContainers().
  then(checkContainers);

dockerEventListener(event => {
  if (event.Type !== 'container') {
    return;
  }

  switch (event.Action) {
    case 'kill':
      if (services.usingContainer(event.id)) {
        services.removeServiceForContainer(event.id);
      }
      break;
    case 'start':
      checkContainers([{ Id: event.id }]);

    // no default
  }
});
