/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import YAML from 'yaml';
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import ScriptFactory from '../script/ScriptFactory';
import CONST from '../../constants/constant';

export default class GrafanaInstaller extends AbstractInstaller {
  public static readonly DIR = `install-grafana`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${GrafanaInstaller.DIR}`;

  public static readonly IMAGE_HOME = `${GrafanaInstaller.INSTALL_HOME}/image`;

  public static readonly GRAFANA_VERSION = `6.4.3`;

  // singleton
  private static instance: GrafanaInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!GrafanaInstaller.instance) {
      GrafanaInstaller.instance = new GrafanaInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
  public async install(param: { callback: any }) {
    const { callback } = param;

    await this.preWorkInstall({
      callback
    });
    await this._installMainMaster(callback);
  }

  public async remove() {
    await this._removeMainMaster();
  }

  // protected abstract 구현
  protected async preWorkInstall(param: { callback: any }) {
    console.debug('@@@@@@ Start pre-installation... @@@@@@');
    const { callback } = param;
    // await this._copyFile(callback);
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // internal network 경우 해주어야 할 작업들
      /**
       * 1. 해당 이미지 파일 다운(client 로컬), 전송 (main 마스터 노드)
       * 2. git guide 다운(client 로컬), 전송(각 노드)
       */
      await this.downloadImageFile();
      await this.sendImageFile();

      await this.downloadGitFile();
      await this.sendGitFile();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (마스터 노드)
       */
      await this.cloneGitFile(callback);
    }

    if (this.env.registry) {
      // 내부 image registry 구축 경우 해주어야 할 작업들
      /**
       * 1. 레지스트리 관련 작업
       */
      await this.registryWork({
        callback
      });
    }

    console.debug('###### Finish pre-installation... ######');
  }

  protected async downloadImageFile() {
    // TODO: download image file
    console.debug(
      '@@@@@@ Start downloading the image file to client local... @@@@@@'
    );
    console.debug(
      '###### Finish downloading the image file to client local... ######'
    );
  }

  protected async sendImageFile() {
    console.debug(
      '@@@@@@ Start sending the image file to main master node... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();
    const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${GrafanaInstaller.DIR}/`;
    await scp.sendFile(mainMaster, srcPath, `${GrafanaInstaller.IMAGE_HOME}/`);
    console.debug(
      '###### Finish sending the image file to main master node... ######'
    );
  }

  protected downloadGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected sendGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected async cloneGitFile(callback: any) {
    console.debug('@@@@@@ Start clone the GIT file at each node... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    const script = ScriptFactory.createScript(mainMaster.os.type);
    mainMaster.cmd = script.cloneGitFile(CONST.GRAFANA_REPO, CONST.GIT_BRANCH);
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish clone the GIT file at each node... ######');
  }

  protected async registryWork(param: { callback: any }) {
    console.debug(
      '@@@@@@ Start pushing the image at main master node... @@@@@@'
    );
    const { callback } = param;
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this.getImagePushScript();
    mainMaster.cmd += this._getImagePathEditScript();
    await mainMaster.exeCmd(callback);
    console.debug(
      '###### Finish pushing the image at main master node... ######'
    );
  }

  protected getImagePushScript(): string {
    let gitPullCommand = `
      mkdir -p ~/${GrafanaInstaller.IMAGE_HOME};
      export GRAFANA_HOME=~/${GrafanaInstaller.IMAGE_HOME};87
      export REGISTRY=${this.env.registry};
      cd $GRAFANA_HOME;
      `;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      gitPullCommand += `
        sudo docker load < grafana_\${GRAFANA_VERSION}.tar
        `;
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      gitPullCommand += `
        sudo docker pull grafana/grafana:\${GRAFANA_VERSION}
        `;
    }
    return `
        ${gitPullCommand}
        sudo docker tag grafana/grafana:\${GRAFANA_VERSION} \${REGISTRY}/grafana:\${GRAFANA_VERSION}

        sudo docker push \${REGISTRY}/grafana:\${GRAFANA_VERSION}
        #rm -rf $GRAFANA_HOME;
        `;
  }

  /**
   * private 메서드
   */
  private async _installMainMaster(callback: any) {
    console.debug('@@@@@@ Start installing main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getVersionEditScript();
    await mainMaster.exeCmd(callback);

    // Step 1. Prometheus 확인
    // Step 2. Grafana deploy
    mainMaster.cmd = this._step2();
    await mainMaster.exeCmd(callback);

    console.debug('###### Finish installing main Master... ######');
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    console.debug('###### Finish remove main Master... ######');
  }

  private _getVersionEditScript(): string {
    return `
      cd ~/${GrafanaInstaller.INSTALL_HOME}/yaml/;
      sed -i 's/{GRAFANA_VERSION}/'${GrafanaInstaller.GRAFANA_VERSION}'/g' grafana.yaml
      `;
  }

  private _step2(): string {
    return `
    cd ~/${GrafanaInstaller.INSTALL_HOME};
    kubectl create -f yaml/;
    `;
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${GrafanaInstaller.INSTALL_HOME};
    kubectl delete -f yaml/;
    `;
  }

  private _getImagePathEditScript(): string {
    return `
    cd ~/${GrafanaInstaller.INSTALL_HOME}/yaml/;
    sed -i "s/grafana\\/grafana/${this.env.registry}\\/grafana/g" grafana.yaml
    `;
  }
}
