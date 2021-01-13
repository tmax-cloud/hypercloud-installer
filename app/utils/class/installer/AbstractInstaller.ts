/* eslint-disable no-underscore-dangle */
import Env from '../Env';

export default abstract class AbstractInstaller {
  // installer 공통

  private _env!: Env;

  /**
   * Getter env
   * @return {Env}
   */
  public get env(): Env {
    return this._env;
  }

  /**
   * Setter env
   * @param {Env} value
   */
  public set env(value: Env) {
    this._env = value;
  }

  // installer 상속 시, 필수 구현되어야 하는 abstract method들
  public abstract install(param?: any): Promise<any>;

  public abstract remove(param?: any): Promise<any>;

  protected abstract _preWorkInstall(param?: any): Promise<any>;

  protected abstract _downloadImageFile(param?: any): Promise<any>;

  protected abstract _sendImageFile(param?: any): Promise<any>;

  protected abstract _registryWork(param?: any): Promise<any>;

  protected abstract _getImagePushScript(param?: any): string;
}
