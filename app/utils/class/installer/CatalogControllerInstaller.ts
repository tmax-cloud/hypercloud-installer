/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import ScriptFactory from '../script/ScriptFactory';
import CONST from '../../constants/constant';

export default class CatalogControllerInstaller extends AbstractInstaller {
  public static readonly DIR = `install-catalog`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${CatalogControllerInstaller.DIR}`;

  public static readonly IMAGE_HOME = `${CatalogControllerInstaller.INSTALL_HOME}/image`;

  public static readonly VERSION = `0.3.0`;

  // singleton
  private static instance: CatalogControllerInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!CatalogControllerInstaller.instance) {
      CatalogControllerInstaller.instance = new CatalogControllerInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
  public async install(param: { callback: any; setProgress: Function }) {
    const { callback, setProgress } = param;

    setProgress(10);
    await this.preWorkInstall({
      callback
    });
    setProgress(60);
    await this._installMainMaster(callback);
    setProgress(100);
  }

  public async remove() {
    await this._removeMainMaster();
  }

  protected async preWorkInstall(param?: any) {
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
    const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${CatalogControllerInstaller.DIR}/`;
    await scp.sendFile(
      mainMaster,
      srcPath,
      `${CatalogControllerInstaller.IMAGE_HOME}/`
    );
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
    mainMaster.cmd = script.cloneGitFile(CONST.CATALOG_REPO, CONST.GIT_BRANCH);
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
    await mainMaster.exeCmd(callback);
    console.debug(
      '###### Finish pushing the image at main master node... ######'
    );
  }

  protected getImagePushScript(): string {
    let gitPullCommand = `
  mkdir -p ~/${CatalogControllerInstaller.IMAGE_HOME};
  export CATALOG_HOME=~/${CatalogControllerInstaller.IMAGE_HOME};
  export CATALOG_VERSION=v${CatalogControllerInstaller.VERSION};
  export REGISTRY=${this.env.registry};
  cd $CATALOG_HOME;
  `;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      gitPullCommand += `
    docker load < service-catalog_v\${CATALOG_VERSION}.tar
    `;
    } else {
      gitPullCommand += `
    docker pull quay.io/kubernetes-service-catalog/service-catalog:v\${CATALOG_VERSION}

    #docker save quay.io/kubernetes-service-catalog/service-catalog:v\${CATALOG_VERSION} > service-catalog_v\${CATALOG_VERSION}.tar
    `;
    }
    return `
    ${gitPullCommand}
    docker tag quay.io/kubernetes-service-catalog/service-catalog:v\${CATALOG_VERSION} \${REGISTRY}/quay.io/kubernetes-service-catalog/service-catalog:v\${CATALOG_VERSION}

    docker push \${REGISTRY}/quay.io/kubernetes-service-catalog/service-catalog:v\${CATALOG_VERSION}
    #rm -rf $CATALOG_HOME;
    `;
  }

  private async _installMainMaster(callback: any) {
    console.debug(
      '@@@@@@ Start installing catalog controller main Master... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();

    // Step0. catalog.config 설정
    mainMaster.cmd = this._step0();
    await mainMaster.exeCmd(callback);

    // Step1. install-catalog
    mainMaster.cmd = this._step1();
    await mainMaster.exeCmd(callback);

    console.debug(
      '###### Finish installing catalog controller main Master... ######'
    );
  }

  private _step0() {
    let script = `
    cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
    sudo sed -i 's|\\r$||g' catalog.config;
    . catalog.config;

    sudo sed -i "s|$catalogVersion|${CatalogControllerInstaller.VERSION}|g" ./catalog.config;
  `;

    if (this.env.registry) {
      script += `sudo sed -i "s|$imageRegistry|${this.env.registry}|g" ./catalog.config;`;
    }

    return script;
  }

  private _step1() {
    return `
    cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
    sudo ./install-catalog.sh install
    `;
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove console main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    console.debug('###### Finish remove console main Master... ######');
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${CatalogControllerInstaller.INSTALL_HOME}/manifest;
    sudo ./install-catalog.sh uninstall
    rm -rf ~/${CatalogControllerInstaller.INSTALL_HOME};
    `;
  }
}
