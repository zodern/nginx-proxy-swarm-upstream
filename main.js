/* eslint-disable no-console, no-warning-comments */
import Services from './services';
import { ContainerWatcher, docker, filterContainers } from './docker';
import { findExistingConfigs, generateConfig, reloadNginx, removeConfigs } from './nginx';

const services = new Services();

services.on('endpointsChanged', service => {
  console.log('endpoint changed:', service.service, service.endpoints);
  generateConfig(service.hosts, service.endpoints, service.port);

  // TODO: debounce
  reloadNginx();
});

services.on('serviceRemoved', service => {
  console.log('service removed:', service.service);
  removeConfigs(service.hosts);

  reloadNginx();
});

function checkContainers (containers) {
  return filterContainers(containers).then(result => {
    if (result.length > 0) {
      console.log('Found services:', result.map(service => service.service));
      services.addServices(result);
    }
  });
}

const containerWatcher = new ContainerWatcher();

containerWatcher.on('kill', containerId => {
  if (services.usingContainer(containerId)) {
    services.removeServiceForContainer(containerId);
  }
});

containerWatcher.on('start', containerId => {
  checkContainers([{ Id: containerId }]);
});

// Find already existent config containers
async function init () {
  const containers = await docker.listContainers();

  checkContainers(containers);

  const generatedHosts = await findExistingConfigs();
  const unused = generatedHosts.filter(host => !services.usingHost(host));

  removeConfigs(unused);
}

init();
