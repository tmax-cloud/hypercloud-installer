/* eslint-disable class-methods-use-this */
import Node from '../Node';
import AbstractScript from './AbstractScript';

export default class CentosScript extends AbstractScript {
  startInstallKubernetes(): string {
    throw new Error('Method not implemented.');
  }

  setEnvForKubernetes(hostName: string): string {
    throw new Error('Method not implemented.');
  }

  startInstallCrio(): string {
    throw new Error('Method not implemented.');
  }

  cloneGitFile(repoPath: string, repoBranch: string): string {
    throw new Error('Method not implemented.');
  }

  installPackage(): string {
    throw new Error('Method not implemented.');
  }

  installLvm2(): string {
    throw new Error('Method not implemented.');
  }

  installNtp(): string {
    throw new Error('Method not implemented.');
  }

  installOpenSSL(): string {
    return `
    apt install openssl;
    apt install oracle-java8-installer;
    `;
  }

  setKubernetesRepo(): string {
    throw new Error('Method not implemented.');
  }

  setCrioRepo(crioVersion: string): string {
    throw new Error('Method not implemented.');
  }

  getMasterMultiplexingScript(
    node: Node,
    priority: number,
    vip: string
  ): string {
    throw new Error('Method not implemented.');
  }

  getK8sMasterRemoveScript(): string {
    throw new Error('Method not implemented.');
  }

  deleteDockerScript(): string {
    throw new Error('Method not implemented.');
  }

  setDockerRepo(): string {
    throw new Error('Method not implemented.');
  }

  getImageRegistrySettingScript(registry: string, type: string): string {
    throw new Error('Method not implemented.');
  }

  setPackageRepository(destPath: string): string {
    throw new Error('Method not implemented.');
  }

  installGdisk(): string {
    throw new Error('Method not implemented.');
  }
}
