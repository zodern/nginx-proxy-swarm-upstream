/* eslint-disable no-console */
import dns from 'dns';
import EventEmitter from 'events';
import { serviceExists } from './docker';

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
   * @param {Array} services Each service should have service, container, hosts, and port properties
   */
  addServices (services) {
    services.forEach(({ service, container, hosts, port }) => {
      this.services[service] = {
        service,
        hosts,
        container,
        port,
        endpoints: [],
        exists: true
      };

      this.getEndpoints(service).catch(console.log);
    });
  }

  serviceExists (serviceName) {
    this.services[serviceName].exists = true;
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

  async handleServiceWithoutDns (serviceName) {
    const exists = await serviceExists(serviceName);

    if (!exists) {
      this.emit('noService', serviceName);
      this.services[serviceName].exists = false;
    }
  }

  checkEndpoints () {
    const promises = Object.keys(this.services).
      filter(serviceName => this.services[serviceName].exists).
      map(serviceName => this.getEndpoints(serviceName).catch(() => {
        this.handleServiceWithoutDns(serviceName);
      }));
    const createTimeout = () => setTimeout(this.checkEndpoints.bind(this), 1000);

    return Promise.all(promises).
      catch(err => {
        console.log(err);
      }).
      finally(createTimeout);
  }

  usingContainer (containerId) {
    return Object.keys(this.services).find(service =>
      this.services[service].container === containerId);
  }

  usingHost (host) {
    return Object.keys(this.services).find(service =>
      this.services[service].hosts.includes(host));
  }

  removeServiceForContainer (containerId) {
    const serviceName = this.usingContainer(containerId);
    const service = this.services[serviceName];

    this.emit('serviceRemoved', service);

    // eslint-disable-next-line prefer-reflect
    delete this.services[serviceName];
  }
}
