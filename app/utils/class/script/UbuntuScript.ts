/* eslint-disable class-methods-use-this */
import AbstractScript from './AbstractScript';

export default class CentosScript extends AbstractScript {
  /**
   * ubuntu 스크립트 구현
   */
  cloneGitFile(repoPath: string, repoBranch: string): string {
    throw new Error('Method not implemented.');
  }

  installPackage(): string {
    throw new Error('Method not implemented.');
  }

  installNtp(): string {
    throw new Error('Method not implemented.');
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
