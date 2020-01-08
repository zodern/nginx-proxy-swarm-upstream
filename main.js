/* eslint-disable no-console, no-warning-comments */
import Services from './services';
import { ContainerWatcher, docker, filterContainers } from './docker';
import { generateConfig, getKnownServices, reloadNginx, removeConfigs } from './nginx';

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

services.on('noService', serviceName => {
  console.log(`Service doesn't exist ${serviceName}`);
});

function checkContainers (containers, existingConfigs) {
  return filterContainers(containers).
    then(result => {
      if (result.length > 0) {
        result = result.map(service => {
          const existingConfig = existingConfigs.find(({ host }) => service.hosts.includes(host)) || {};

          return {
            ...service,
            endpoints: existingConfig.endpoints || []
          };
        });
        services.addServices(result);
      }
    });
}

const dockerWatcher = new ContainerWatcher();

dockerWatcher.on('containerKilled', containerId => {
  if (services.usingContainer(containerId)) {
    services.removeServiceForContainer(containerId);
  }
});

dockerWatcher.on('containerStarted', containerId => {
  checkContainers([{ Id: containerId }]);
});

dockerWatcher.on('serviceCreated', (_id, serviceName) => {
  services.serviceExists(serviceName);
});

// Find already existent config containers
async function init () {
  const containers = await docker.listContainers();
  const generatedHosts = await getKnownServices();

  await checkContainers(containers, generatedHosts);

  const unused = generatedHosts.
    filter(({ host }) => !services.usingHost(host)).
    map(({ host }) => host);

  removeConfigs(unused);
}

init();
