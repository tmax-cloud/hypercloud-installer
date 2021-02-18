/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import ScriptFactory from '../script/ScriptFactory';
import CONST from '../../constants/constant';

export default class SecretWatcherInstaller extends AbstractInstaller {
  public static readonly DIR = `install-secretwatcher`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${SecretWatcherInstaller.DIR}`;

  public static readonly IMAGE_HOME = `${SecretWatcherInstaller.INSTALL_HOME}/image`;

  public static readonly HPCD_SW_VERSION = `4.1.0.9`;

  // singleton
  private static instance: SecretWatcherInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!SecretWatcherInstaller.instance) {
      SecretWatcherInstaller.instance = new SecretWatcherInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
  public async install(param: { callback: any; setProgress: Function }) {
    const { callback } = param;

    await this.preWorkInstall({
      callback
    });

    await this._installMainMaster(callback);
  }

  public async remove() {
    await this._removeMainMaster();
  }

  protected async preWorkInstall(param?: any) {
    console.debug('@@@@@@ Start pre-installation... @@@@@@');
    const { callback } = param;
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
      // TODO: downloadYamlAtLocal();
      // TODO: sendYaml();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (마스터 노드)
       */
      await this.cloneGitFile(callback);
      await this._downloadYaml();
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
    const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${SecretWatcherInstaller.DIR}/`;
    await scp.sendFile(
      mainMaster,
      srcPath,
      `${SecretWatcherInstaller.IMAGE_HOME}/`
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
    mainMaster.cmd = script.cloneGitFile(
      CONST.SECRET_WATCHER_REPO,
      CONST.GIT_BRANCH
    );
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
    mkdir -p ~/${SecretWatcherInstaller.IMAGE_HOME};
    export HPCD_SW_HOME=~/${SecretWatcherInstaller.IMAGE_HOME};
    export HPCD_SW_VERSION=v${SecretWatcherInstaller.HPCD_SW_VERSION};
    export REGISTRY=${this.env.registry};
    cd $HPCD_SW_HOME;
    `;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      gitPullCommand += `
      sudo docker load < hypercloud4-secret-watcher_b\${HPCD_SW_VERSION}.tar;

      `;
    } else {
      gitPullCommand += `
      sudo docker pull tmaxcloudck/hypercloud4-secret-watcher:b\${HPCD_SW_VERSION};
      `;
    }
    return `
      ${gitPullCommand}
      sudo docker tag tmaxcloudck/hypercloud4-secret-watcher:b\${HPCD_SW_VERSION} \${REGISTRY}/tmaxcloudck/hypercloud4-secret-watcher:b\${HPCD_SW_VERSION};

      sudo docker push \${REGISTRY}/tmaxcloudck/hypercloud4-secret-watcher:b\${HPCD_SW_VERSION};
      #rm -rf $HPCD_SW_HOME;
      `;
  }

  private async _installMainMaster(callback: any) {
    console.debug(
      '@@@@@@ Start installing secret watcher main Master... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();

    // Step 0. hypercloud-secret-watcher-daemonset.yaml 수정
    mainMaster.cmd = this._step0();
    await mainMaster.exeCmd(callback);

    // Step 1. hypercloud-secret-watcher-daemonset.yaml 실행
    mainMaster.cmd = this._step1();
    await mainMaster.exeCmd(callback);

    console.debug(
      '###### Finish installing secret watcher main Master... ######'
    );
  }

  private _step0() {
    let script = `
    cd ~/${SecretWatcherInstaller.INSTALL_HOME}/manifest;
    tar -xzf secret-watcher.tar.gz

    sed -i 's/tmaxcloudck\\/hypercloud4-secret-watcher:latest/tmaxcloudck\\/hypercloud4-secret-watcher:'b${SecretWatcherInstaller.HPCD_SW_VERSION}'/g' secret-watcher-${SecretWatcherInstaller.HPCD_SW_VERSION}/k8s-install/hypercloud-secret-watcher-daemonset.yaml
    `;

    if (this.env.registry) {
      script += `
      sed -i 's/ tmaxcloudck/ '${this.env.registry}'\\/tmaxcloudck/g' secret-watcher-${SecretWatcherInstaller.HPCD_SW_VERSION}/k8s-install/hypercloud-secret-watcher-daemonset.yaml
      `;
    }
    return script;
  }

  private _step1() {
    return `
    cd ~/${SecretWatcherInstaller.INSTALL_HOME}/manifest;
    kubectl apply -f secret-watcher-${SecretWatcherInstaller.HPCD_SW_VERSION}/k8s-install/hypercloud-secret-watcher-daemonset.yaml
    `;
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove secret watcher main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    console.debug('###### Finish remove secret watcher main Master... ######');
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${SecretWatcherInstaller.INSTALL_HOME}/manifest;
    kubectl delete -f secret-watcher-${SecretWatcherInstaller.HPCD_SW_VERSION}/k8s-install/hypercloud-secret-watcher-daemonset.yaml

    rm -rf ~/${SecretWatcherInstaller.INSTALL_HOME};
    `;
  }

  private async _downloadYaml() {
    console.debug('@@@@@@ Start download yaml file from external... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = `
    mkdir -p ~/${SecretWatcherInstaller.INSTALL_HOME}/manifest;
    cd ~/${SecretWatcherInstaller.INSTALL_HOME}/manifest;
    wget -O secret-watcher.tar.gz https://github.com/tmax-cloud/secret-watcher/archive/v${SecretWatcherInstaller.HPCD_SW_VERSION}.tar.gz;
    `;
    await mainMaster.exeCmd();
    console.debug('###### Finish download yaml file from external... ######');
  }
}
