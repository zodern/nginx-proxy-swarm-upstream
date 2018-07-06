/* eslint-disable no-console */
import dns from 'dns';
import EventEmitter from 'events';

function compareArrays (array1, array2) {
  return array1.every((item, index) => array2[index] === item);
}

export default class Services extends EventEmitter {
  constructor () {
    super();

    this.services = {};
    this.checkEndpoints();
  }

  /**
   * Add services
   * @param {Array} services Each service should have service, container, and hosts properties
   */
  addServices (services) {
    services.forEach(({ service, container, hosts }) => {
      this.services[service] = {
        service,
        hosts,
        container,
        endpoints: []
      };

      this.getEndpoints(service).catch(console.log);
    });
  }

  getEndpoints (service) {
    return new Promise((resolve, reject) => {
      dns.resolve4(service, 'A', (err, addresses) => {
        if (err) {
          return reject(err);
        }

        addresses.sort();

        if (!compareArrays(addresses, this.services[service].endpoints)) {
          this.services[service].endpoints = addresses;
          this.emit('endpointsChanged', this.services[service]);
        }

        resolve();
      });
    });
  }

  checkEndpoints () {
    const promises = Object.keys(this.services).map(service => this.getEndpoints(service));
    const createTimeout = () => setTimeout(this.checkEndpoints.bind(this), 1000);

    Promise.all(promises).
      then(createTimeout).
      catch(err => {
        console.log(err);
        createTimeout();
      });
  }

  usingContainer (containerId) {
    return Object.keys(this.services).find(service =>
      this.services[service].container === containerId);
  }

  removeServiceForContainer (containerId) {
    const serviceName = this.usingContainer(containerId);
    const service = this.services[serviceName];

    this.emit('serviceRemoved', service);

    // eslint-disable-next-line prefer-reflect
    delete this.services[serviceName];
  }
}
